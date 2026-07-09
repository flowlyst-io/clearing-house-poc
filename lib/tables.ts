// Reconstruct table structure (rows × columns) from a PDF page's positioned
// text items — purely from the coordinates pdfjs already gives us, with NO OCR.
// A PDF has no concept of a "table": it's just text runs painted at (x, y) with
// grid lines drawn separately. lib/pdf.ts keeps only the text; here we use the
// discarded geometry to recover columns.
//
// This is heuristic and POC-grade. It handles clean, grid-aligned tables (e.g.
// salary schedules). It will mis-handle: merged cells, cells whose text wraps
// onto multiple lines, and borderless/irregular layouts. It errs toward NOT
// reporting a table (see the density/occupancy checks) so ordinary justified
// prose isn't misread as tabular. Callers treat the output as presentational —
// the flat page text in lib/pdf.ts stays the source of truth for parsing and
// anchoring.

/** A single text run with its position, in PDF user space (origin bottom-left). */
export interface PositionedItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Table {
  rows: string[][];
  ncols: number;
}

/** A row of items known to sit on the same visual line, sorted left-to-right. */
interface Row {
  y: number;
  fontUnit: number; // representative font height for this row
  items: PositionedItem[];
}

/** A contiguous run of text on one line, after merging within-cell gaps. */
interface Cell {
  text: string;
  x: number; // start x of the cell
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Group items into visual rows: sort top-to-bottom (PDF y decreases downward),
 * then start a new row whenever y jumps by more than ~half the font height.
 */
function groupRows(items: PositionedItem[]): Row[] {
  const withText = items.filter((it) => it.str.trim() !== "");
  if (withText.length === 0) return [];
  const sorted = [...withText].sort((a, b) => b.y - a.y);

  const rows: Row[] = [];
  let current: PositionedItem[] = [];
  let anchorY = sorted[0].y;
  let anchorH = sorted[0].height || 10;

  for (const it of sorted) {
    const tol = Math.max(2, (it.height || anchorH) * 0.5);
    if (current.length > 0 && Math.abs(it.y - anchorY) > tol) {
      rows.push(finishRow(current));
      current = [];
    }
    if (current.length === 0) {
      anchorY = it.y;
      anchorH = it.height || 10;
    }
    current.push(it);
  }
  if (current.length > 0) rows.push(finishRow(current));
  return rows;
}

function finishRow(items: PositionedItem[]): Row {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  return {
    y: sorted[0].y,
    fontUnit: median(sorted.map((it) => it.height || 0)) || 10,
    items: sorted,
  };
}

/**
 * Split a row into cells: merge adjacent items into the same cell until the
 * horizontal gap between them exceeds the column threshold (a multiple of the
 * row's median inter-item gap, floored relative to the font size).
 */
function splitCells(row: Row): Cell[] {
  const { items, fontUnit } = row;
  const gaps: number[] = [];
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const gap = items[i].x - (prev.x + prev.width);
    if (gap > 0) gaps.push(gap);
  }
  const threshold = Math.max(median(gaps) * 2.5, fontUnit * 0.6);

  const cells: Cell[] = [];
  let buf: PositionedItem[] = [items[0]];
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const gap = items[i].x - (prev.x + prev.width);
    if (gap > threshold) {
      cells.push(toCell(buf));
      buf = [];
    }
    buf.push(items[i]);
  }
  if (buf.length > 0) cells.push(toCell(buf));
  return cells;
}

function toCell(items: PositionedItem[]): Cell {
  const text = items
    .map((it) => it.str)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return { text, x: items[0].x };
}

// A run of fewer rows than this is not considered a table.
const MIN_TABLE_ROWS = 2;
// A cell start-x within this fraction of the font unit joins an existing column.
const COLUMN_TOL_FACTOR = 1.2;

// An enumeration marker like "1.", "12.", "(3)", "a)", "iv." — a left-aligned
// list bullet, NOT a data column. A numbered/lettered list has these stacked in
// its first column with prose beside them; that lines up like a 2-column table
// but isn't one, so we reject a run whose leading column is mostly markers.
const MARKER_RE = /^\(?(?:\d{1,3}|[a-zA-Z]|[ivxlcdmIVXLCDM]{1,4})\)?[.)]?$/;
const MARKER_COL_FRACTION = 0.6;

function isMarkerColumn(cells: string[]): boolean {
  const filled = cells.filter((c) => c !== "");
  if (filled.length === 0) return false;
  const markers = filled.filter((c) => MARKER_RE.test(c)).length;
  return markers / filled.length >= MARKER_COL_FRACTION;
}

/**
 * Reconstruct all tables on a page. Walks rows top-to-bottom, collects maximal
 * runs of consecutive multi-column rows, and accepts a run as a table only when
 * its cells cluster into ≥2 columns that are each populated across a majority of
 * the run's rows. That occupancy check is what rejects ragged prose (whose
 * "columns" don't line up row to row) while keeping real grids.
 */
export function reconstructTables(items: PositionedItem[]): Table[] {
  const rows = groupRows(items);
  const tables: Table[] = [];

  let run: { row: Row; cells: Cell[] }[] = [];
  const flush = () => {
    const table = runToTable(run);
    if (table) tables.push(table);
    run = [];
  };

  for (const row of rows) {
    const cells = splitCells(row);
    if (cells.length >= 2) {
      run.push({ row, cells });
    } else {
      flush();
    }
  }
  flush();

  return tables;
}

function runToTable(run: { row: Row; cells: Cell[] }[]): Table | null {
  if (run.length < MIN_TABLE_ROWS) return null;

  const fontUnit = median(run.map((r) => r.row.fontUnit)) || 10;
  const tol = Math.max(6, fontUnit * COLUMN_TOL_FACTOR);

  // Cluster every cell's start-x into column bins.
  const allX = run.flatMap((r) => r.cells.map((c) => c.x)).sort((a, b) => a - b);
  const bins: number[] = [];
  for (const x of allX) {
    if (bins.length === 0 || x - bins[bins.length - 1] > tol) bins.push(x);
  }
  if (bins.length < 2) return null;

  const binOf = (x: number) => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < bins.length; i++) {
      const d = Math.abs(x - bins[i]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };

  // Occupancy per bin: how many rows place a cell there.
  const occupancy = new Array(bins.length).fill(0);
  const rowBins = run.map(({ cells }) => {
    const map = new Map<number, string>();
    for (const c of cells) {
      const b = binOf(c.x);
      map.set(b, map.has(b) ? `${map.get(b)} ${c.text}`.trim() : c.text);
    }
    for (const b of map.keys()) occupancy[b] += 1;
    return map;
  });

  // Keep only columns populated in a majority of rows — prunes stray prose gaps.
  const minOcc = Math.max(2, Math.ceil(run.length * 0.5));
  const kept = bins.map((_, i) => i).filter((i) => occupancy[i] >= minOcc);
  if (kept.length < 2) return null;

  const grid = rowBins.map((map) => kept.map((b) => map.get(b) ?? ""));
  // Drop rows that ended up with fewer than 2 filled cells against kept columns.
  const rows = grid.filter((r) => r.filter((c) => c !== "").length >= 2);
  if (rows.length < MIN_TABLE_ROWS) return null;

  // Reject numbered/lettered lists masquerading as a 2-column table.
  if (isMarkerColumn(rows.map((r) => r[0]))) return null;

  return { rows, ncols: kept.length };
}
