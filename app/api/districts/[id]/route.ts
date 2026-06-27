import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { districts } from "@/lib/db/schema";
import { patchToColumns, rowToDistrict } from "@/lib/db/serialize";
import { classifyError } from "@/lib/apiError";
import type { District } from "@/lib/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// GET /api/districts/:id — a single district WITH its `pages` (the full select),
// so the Review document reader can render the contract text.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const [row] = await db.select().from(districts).where(eq(districts.id, id));

    if (!row) {
      return NextResponse.json(
        { error: "District not found.", retryable: false },
        { status: 404 },
      );
    }
    return NextResponse.json(rowToDistrict(row));
  } catch (err) {
    const { status, body } = classifyError(err);
    return NextResponse.json(body, { status });
  }
}

// PATCH /api/districts/:id — partial update (body is Partial<District>).
// Returns the full updated row (incl. pages) so the client can refresh in place.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const patch = (await req.json()) as Partial<District>;
    const cols = patchToColumns(patch);

    if (Object.keys(cols).length === 0) {
      return NextResponse.json(
        { error: "No updatable fields in the request.", retryable: false },
        { status: 400 },
      );
    }

    const [row] = await db
      .update(districts)
      .set(cols)
      .where(eq(districts.id, id))
      .returning();

    if (!row) {
      return NextResponse.json(
        { error: "District not found.", retryable: false },
        { status: 404 },
      );
    }
    return NextResponse.json(rowToDistrict(row));
  } catch (err) {
    const { status, body } = classifyError(err);
    return NextResponse.json(body, { status });
  }
}

// DELETE /api/districts/:id
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const [row] = await db
      .delete(districts)
      .where(eq(districts.id, id))
      .returning({ id: districts.id });

    if (!row) {
      return NextResponse.json(
        { error: "District not found.", retryable: false },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, id: row.id });
  } catch (err) {
    const { status, body } = classifyError(err);
    return NextResponse.json(body, { status });
  }
}
