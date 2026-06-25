import { NextRequest, NextResponse } from "next/server";
import { getAnthropic, SUMMARIZE_MODEL } from "@/lib/anthropic";
import { classifyError } from "@/lib/apiError";

export const runtime = "nodejs";

interface Item {
  districtName: string;
  value: string;
}
interface SectionInput {
  label: string;
  items: Item[];
}

// POST /api/summarize
// Body: { sections: [{ label, items: [{ districtName, value }] }] }
// Returns: { synthesis } — ONE short overview across all the selected sections
// and districts. Per-row min/median/max stats are computed on the client; this
// endpoint only writes the natural-language read.
export async function POST(req: NextRequest) {
  try {
    const { sections } = (await req.json()) as { sections: SectionInput[] };

    const usable = Array.isArray(sections)
      ? sections.filter((s) => s?.label && Array.isArray(s.items) && s.items.length > 0)
      : [];
    if (usable.length === 0) {
      return NextResponse.json(
        {
          error: "A non-empty sections array (each with items) is required.",
          retryable: false,
        },
        { status: 400 },
      );
    }

    const grid = usable
      .map(
        (s) =>
          `${s.label}: ` +
          s.items.map((i) => `${i.districtName} = ${i.value}`).join("; "),
      )
      .join("\n");

    const client = getAnthropic();
    const response = await client.messages.create({
      model: SUMMARIZE_MODEL,
      max_tokens: 600,
      // Haiku 4.5 supports structured outputs but not `effort`/adaptive thinking.
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              synthesis: {
                type: "string",
                description:
                  "A short (2-4 sentence) plain-language overview across all the sections and districts.",
              },
            },
            required: ["synthesis"],
            additionalProperties: false,
          },
        },
      },
      system:
        "You help a school-district negotiator read a comparison table covering " +
        "several contract sections across several districts. Write a SHORT overview " +
        "(2-4 plain sentences): the overall picture — which districts tend to be more " +
        "or less generous across these sections, and the most notable differences or " +
        "outliers. Be factual and grounded ONLY in the values given; never invent " +
        "numbers or terms. No preamble, no bullet points, no headings.",
      messages: [
        {
          role: "user",
          content: `Comparison (section: district = value):\n\n${grid}`,
        },
      ],
    });

    const text = response.content.find((b) => b.type === "text");
    const raw = text && "text" in text ? text.text : "{}";
    const parsed = JSON.parse(raw) as { synthesis?: string };

    return NextResponse.json({ synthesis: parsed.synthesis ?? "" });
  } catch (err) {
    const { status, body } = classifyError(err);
    return NextResponse.json(body, { status });
  }
}
