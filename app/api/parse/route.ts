import { NextRequest, NextResponse } from "next/server";
import { getAnthropic, PARSE_MODEL } from "@/lib/anthropic";
import { classifyError } from "@/lib/apiError";
import { TAXONOMY } from "@/lib/taxonomy";
import type { ParseResult, ParsedSection } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const KEYS = TAXONOMY.map((s) => s.key);
const CONFIDENCE_FLOOR = 0.75; // below this, a human verifies

const taxonomyBrief = TAXONOMY.map(
  (s) => `- ${s.key} (${s.label}): ${s.description} VALUE: ${s.valueHint}`,
).join("\n");

// POST /api/parse
// Body: { text, districtName? }
// Returns: ParseResult { districtName, term, sections[], unmatched[] }
export async function POST(req: NextRequest) {
  try {
    const { text, districtName } = (await req.json()) as {
      text: string;
      districtName?: string;
    };

    if (!text || text.trim().length < 200) {
      return NextResponse.json(
        {
          error: "Provide the contract text (at least a couple hundred characters).",
          retryable: false,
        },
        { status: 400 },
      );
    }

    // Guard against absurdly large inputs; a CBA is well within this.
    const contract = text.slice(0, 600_000);

    const client = getAnthropic();
    const stream = client.messages.stream({
      model: PARSE_MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high", // accuracy over flash — these users punish mistakes
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              districtName: { type: "string" },
              term: { type: "string" },
              sections: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    taxonomyKey: { type: "string", enum: KEYS },
                    found: { type: "boolean" },
                    extractedValue: { type: "string" },
                    sourceText: { type: "string" },
                    confidence: { type: "number" },
                  },
                  required: [
                    "taxonomyKey",
                    "found",
                    "extractedValue",
                    "sourceText",
                    "confidence",
                  ],
                  additionalProperties: false,
                },
              },
              unmatched: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    sourceText: { type: "string" },
                  },
                  required: ["label", "sourceText"],
                  additionalProperties: false,
                },
              },
            },
            required: ["districtName", "term", "sections", "unmatched"],
            additionalProperties: false,
          },
        },
      },
      system: [
        "You extract structured data from a New York public-school teachers' collective bargaining agreement (CBA).",
        "The text comes from OCR, so expect artifacts: split words ('LEA VE' = 'LEAVE'), stray spaces, garbled roman numerals. Read through them.",
        "",
        "Map the contract into this FIXED comparison taxonomy. Produce exactly one entry per key:",
        taxonomyBrief,
        "",
        "For each section:",
        "- found: true only if the contract actually addresses it.",
        "- extractedValue: the concise, scannable value described by VALUE above (e.g. '5 days', '$48,000 start / $89,400 max', '85% individual / 75% family'). Keep it short — it goes on a comparison card. If found is false, use an empty string.",
        "- sourceText: the verbatim contract language for this section (you may repair obvious OCR spacing). One to a few sentences — enough to justify the value. Empty string if not found.",
        "- confidence: 0.0–1.0, honest. Lower it when the value is implied rather than stated, when OCR made the clause hard to read, or when the contract is ambiguous. This drives which sections a human reviews, so do not inflate it.",
        "",
        "Also infer the district name and the contract term (e.g. '2023–2027') from the document.",
        "Put any substantive section that does NOT fit the taxonomy into 'unmatched' (label + a short source excerpt) so a person can place it. Do not force-fit.",
      ].join("\n"),
      messages: [
        {
          role: "user",
          content: `${
            districtName ? `District (hint): ${districtName}\n\n` : ""
          }Contract text:\n\n${contract}`,
        },
      ],
    });

    const message = await stream.finalMessage();
    const textBlock = message.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "{}";

    const parsed = JSON.parse(raw) as {
      districtName: string;
      term: string;
      sections: {
        taxonomyKey: string;
        found: boolean;
        extractedValue: string;
        sourceText: string;
        confidence: number;
      }[];
      unmatched: { label: string; sourceText: string }[];
    };

    // Keep only found sections; status from confidence (low → flagged for a human).
    const sections: ParsedSection[] = parsed.sections
      .filter((s) => s.found && s.extractedValue.trim())
      .map((s) => {
        const low = s.confidence < CONFIDENCE_FLOOR;
        return {
          taxonomyKey: s.taxonomyKey,
          extractedValue: s.extractedValue.trim(),
          sourceText: s.sourceText.trim(),
          confidence: s.confidence,
          status: low ? "flagged" : "confirmed",
          note: low ? "Low confidence — please verify." : undefined,
        };
      });

    const result: ParseResult = {
      districtName: parsed.districtName || districtName || "Untitled district",
      term: parsed.term || undefined,
      sections,
      unmatched: parsed.unmatched ?? [],
    };

    return NextResponse.json(result);
  } catch (err) {
    const { status, body } = classifyError(err);
    return NextResponse.json(body, { status });
  }
}
