// District viz palette — assigned in pool order (index into the pooled districts).
// Powers Compare's district dots (filter rail), column header swatches, and the
// range-bar dots, so a district reads as the same color everywhere on the screen.

export const DISTRICT_COLORS = [
  "#2456c9",
  "#0f8a6e",
  "#6b46c1",
  "#c07211",
  "#c23b5a",
  "#0e7490",
  "#9d3aa8",
  "#475569",
] as const;

/** Color for a district by its position in the pool (wraps past 8). */
export function districtColor(poolIndex: number): string {
  return DISTRICT_COLORS[((poolIndex % DISTRICT_COLORS.length) + DISTRICT_COLORS.length) % DISTRICT_COLORS.length];
}
