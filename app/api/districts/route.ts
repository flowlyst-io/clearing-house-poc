import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { districts } from "@/lib/db/schema";
import { rowToDistrict } from "@/lib/db/serialize";
import { classifyError } from "@/lib/apiError";
import type { District } from "@/lib/types";

export const runtime = "nodejs";

// GET /api/districts — the whole pool, oldest first.
// Deliberately omits raw_text: a full contract can be 100KB+ and this list is
// fetched on every Compare/Review load. Fetch a single district to get its text.
export async function GET() {
  try {
    const rows = await db
      .select({
        id: districts.id,
        name: districts.name,
        term: districts.term,
        source: districts.source,
        inPool: districts.inPool,
        sections: districts.sections,
        unmatched: districts.unmatched,
        createdAt: districts.createdAt,
      })
      .from(districts)
      .orderBy(districts.createdAt);

    return NextResponse.json(rows.map(rowToDistrict));
  } catch (err) {
    const { status, body } = classifyError(err);
    return NextResponse.json(body, { status });
  }
}

// POST /api/districts — create one district (body is a full District, incl. rawText).
export async function POST(req: NextRequest) {
  try {
    const d = (await req.json()) as District;

    if (!d?.id || !d?.name) {
      return NextResponse.json(
        { error: "A district needs at least an id and a name.", retryable: false },
        { status: 400 },
      );
    }

    const [row] = await db
      .insert(districts)
      .values({
        id: d.id,
        name: d.name,
        term: d.term ?? null,
        source: d.source,
        inPool: d.inPool ?? false,
        sections: d.sections ?? [],
        unmatched: d.unmatched ?? [],
        rawText: d.rawText ?? null,
        createdAt: d.createdAt,
      })
      .returning();

    return NextResponse.json(rowToDistrict(row), { status: 201 });
  } catch (err) {
    const { status, body } = classifyError(err);
    return NextResponse.json(body, { status });
  }
}
