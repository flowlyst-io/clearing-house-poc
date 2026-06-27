import type { District, DistrictSource } from "../types";
import type { DistrictRow } from "./schema";

// Postgres uses null for absent columns; the District type uses optional/undefined.
// rowToDistrict bridges that, and is the single place the API shapes its output.
// `pages` is only present when the row was selected with it (single-district GET);
// list queries omit the column, so it stays undefined there.
export function rowToDistrict(
  row: Omit<DistrictRow, "pages"> & { pages?: string[] | null },
): District {
  return {
    id: row.id,
    name: row.name,
    term: row.term ?? undefined,
    source: row.source as DistrictSource,
    sections: row.sections,
    unmatched: row.unmatched,
    pages: row.pages ?? undefined,
    inPool: row.inPool,
    createdAt: row.createdAt,
  };
}

// Translate a Partial<District> patch into the column map for db.update().set().
// Only keys actually present in the patch are written, so a PATCH never clobbers
// fields it didn't mean to touch.
export function patchToColumns(patch: Partial<District>) {
  const cols: Record<string, unknown> = {};
  if ("name" in patch) cols.name = patch.name;
  if ("term" in patch) cols.term = patch.term ?? null;
  if ("source" in patch) cols.source = patch.source;
  if ("inPool" in patch) cols.inPool = patch.inPool;
  if ("sections" in patch) cols.sections = patch.sections;
  if ("unmatched" in patch) cols.unmatched = patch.unmatched;
  if ("pages" in patch) cols.pages = patch.pages ?? null;
  return cols;
}
