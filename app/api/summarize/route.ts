import { NextRequest, NextResponse } from "next/server";
import { getAnthropic, SUMMARIZE_MODEL } from "@/lib/anthropic";
import { TAXONOMY_BY_KEY } from "@/lib/taxonomy";

export const runtime = "nodejs";

interface Item {
  districtName: string;
  value: string;
  sourceText?: string;
}

// POST /api/summarize
// Body: { taxonomyKey, items: [{ districtName, value, sourceText? }] }
// Returns: { synthesis }
// Stats (min/max/median) are computed deterministically on the client — this
// endpoint only writes the short natural-language read on how districts compare.
export async function POST(req: NextRequest) {
  try {
    const { taxonomyKey, items } = (await req.json()) as {
      taxonomyKey: string;
      items: Item[];
    };

    const section = TAXONOMY_BY_KEY[taxonomyKey];
    if (!section || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "taxonomyKey and a non-empty items array are required." },
        { status: 400 },
      );
    }

    const rows = items
      .map((i) => `- ${i.districtName}: ${i.value}`)
      .join("\n");

    const client = getAnthropic();
    const response = await client.messages.create({
      model: SUMMARIZE_MODEL,
      max_tokens: 400,
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
                  "One or two plain sentences comparing the districts on this section.",
              },
            },
            required: ["synthesis"],
            additionalProperties: false,
          },
        },
      },
      system:
        "You help a school-district negotiator quickly read a comparison table. " +
        "Given how several districts handle one contract section, write ONE or TWO " +
        "plain sentences on how they compare — note the spread (who is most/least " +
        "generous) and anything notable. Be factual and grounded ONLY in the values " +
        "given; never invent numbers or terms. No preamble, no bullet points.",
      messages: [
        {
          role: "user",
          content: `Section: ${section.label} — ${section.description}\n\nValues by district:\n${rows}`,
        },
      ],
    });

    const text = response.content.find((b) => b.type === "text");
    const raw = text && "text" in text ? text.text : "{}";
    const parsed = JSON.parse(raw) as { synthesis?: string };

    return NextResponse.json({ synthesis: parsed.synthesis ?? "" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
