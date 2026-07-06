// Locate AI-extracted passages inside the raw page text so the document reader
// can highlight them in place. The model's `anchor` is meant to be verbatim, but
// OCR text is noisy, so we match on a NORMALIZED form (lowercased, whitespace
// runs collapsed) and map the hit back to raw offsets to slice the original.

interface Normalized {
  norm: string;
  /** map[i] = index in the original string of normalized char i. */
  map: number[];
}

function normalize(s: string): Normalized {
  const chars: string[] = [];
  const map: number[] = [];
  let prevSpace = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (/\s/.test(c)) {
      if (prevSpace) continue; // collapse whitespace runs
      chars.push(" ");
      map.push(i);
      prevSpace = true;
    } else {
      chars.push(c.toLowerCase());
      map.push(i);
      prevSpace = false;
    }
  }
  return { norm: chars.join(""), map };
}

/** Find `query` within `pageText`; returns raw [start, end) offsets or null. */
export function locate(
  pageText: string,
  query: string,
): { start: number; end: number } | null {
  const q = normalize(query).norm.trim();
  if (q.length < 4) return null; // too short to anchor reliably
  const { norm, map } = normalize(pageText);
  const idx = norm.indexOf(q);
  if (idx === -1) return null;
  return { start: map[idx], end: map[idx + q.length - 1] + 1 };
}

// How many chars of the selection's edges to keep as start/end locators.
const SELECTION_ANCHOR_LEN = 40;

/**
 * Turn a user-selected passage into the verbatim `anchor` (start locator) and
 * `anchorEnd` (end locator) that `locateSpan` re-matches to highlight the EXACT
 * selection — the same shape the parser emits. Unlike a terse AI anchor (a mere
 * locator that `locateSpan` grows to a sentence boundary), a user drag IS the
 * intended span, so we emit a head + a tail and let `locateSpan` highlight
 * precisely `[head … tail]` with no boundary expansion.
 *
 * The two locators are each up to 40 chars but never more than half the
 * selection, so they can't overlap and `locateSpan` always finds the tail
 * strictly after the head. Anchors are matched, never shown, so an occasional
 * mid-word cut is fine — they stay exact substrings of `sourceText`, never
 * repaired. Only a selection too short to split into two reliable (≥4 normalized
 * char) locators collapses to a single anchor and leans on `locateSpan`'s
 * `expandToBoundary` fallback — a rare, tiny-selection case.
 */
export function selectionToAnchors(sourceText: string): {
  anchor: string;
  anchorEnd?: string;
} {
  const text = sourceText;
  const size = Math.min(SELECTION_ANCHOR_LEN, Math.floor(text.length / 2));
  if (size < 8) return { anchor: text };
  return { anchor: text.slice(0, size), anchorEnd: text.slice(text.length - size) };
}

// A located span never grows past this many raw chars — a guard against a bad
// end anchor (or a runaway boundary expansion) highlighting half the page.
const MAX_SPAN_CHARS = 1400;
// How far the no-end-anchor fallback may grow past the start anchor.
const EXPAND_CHARS = 600;

/**
 * Locate the full section span: from the START of `startQuery` to the END of
 * `endQuery` (when that end anchor is present, sits after the start, and stays
 * within MAX_SPAN_CHARS). Otherwise fall back to growing the start anchor out to
 * the surrounding sentence/clause via `expandToBoundary`. Returns raw [start,
 * end) offsets, or null when the start anchor itself can't be found.
 */
export function locateSpan(
  pageText: string,
  startQuery: string,
  endQuery?: string,
): { start: number; end: number } | null {
  const startNorm = normalize(startQuery).norm.trim();
  if (startNorm.length < 4) return null;
  const { norm, map } = normalize(pageText);
  const startIdx = norm.indexOf(startNorm);
  if (startIdx === -1) return null;
  const start = map[startIdx];

  const endNorm = endQuery ? normalize(endQuery).norm.trim() : "";
  if (endNorm.length >= 4) {
    // Search for the end anchor strictly AFTER the start match.
    const endIdx = norm.indexOf(endNorm, startIdx + startNorm.length);
    if (endIdx !== -1) {
      const end = map[endIdx + endNorm.length - 1] + 1;
      if (end > start && end - start <= MAX_SPAN_CHARS) return { start, end };
    }
  }

  // No usable end anchor — grow the start anchor to a natural boundary.
  return expandToBoundary(pageText, { start, end: map[startIdx + startNorm.length - 1] + 1 });
}

/**
 * Grow a located start range out to the surrounding sentence/clause: right to the
 * next sentence terminator or blank line, and modestly left to the start of the
 * current sentence/line. Capped at EXPAND_CHARS so it never runs away.
 */
export function expandToBoundary(
  pageText: string,
  range: { start: number; end: number },
): { start: number; end: number } {
  const isBreak = (c: string) => c === "." || c === ";" || c === "\n";

  // Right: scan forward to the next sentence break (consume a trailing "." etc.),
  // and stop early on a blank line (paragraph boundary).
  let end = range.end;
  const rightCap = Math.min(pageText.length, range.start + EXPAND_CHARS);
  while (end < rightCap) {
    const c = pageText[end];
    if (c === "\n" && pageText[end + 1] === "\n") break; // blank line = new paragraph
    if (isBreak(c)) {
      if (c === ".") end += 1; // include the period
      break;
    }
    end += 1;
  }

  // Left: scan back to just after the previous sentence break or line start.
  let start = range.start;
  const leftCap = Math.max(0, range.end - EXPAND_CHARS);
  while (start > leftCap) {
    const c = pageText[start - 1];
    if (isBreak(c)) break;
    start -= 1;
  }
  // Don't carry leading whitespace into the highlight.
  while (start < range.start && /\s/.test(pageText[start])) start += 1;

  return { start, end };
}

export interface AnchorItem {
  id: string;
  /** The verbatim start anchor, or a sourceText prefix as fallback. */
  query: string;
  /** The verbatim end anchor, when the parser supplied one. */
  endQuery?: string;
}

export interface Segment {
  text: string;
  /** Set when this run is a highlighted match for the given item. */
  itemId?: string;
}

/**
 * Split one page's text into plain + highlighted segments. Earliest match wins
 * on overlap. Returns the ids actually placed so the caller can flag the rest
 * as "not located in text".
 */
export function buildSegments(
  pageText: string,
  items: AnchorItem[],
): { segments: Segment[]; placed: Set<string> } {
  const ranges: { start: number; end: number; id: string }[] = [];
  for (const it of items) {
    if (!it.query) continue;
    const r = locateSpan(pageText, it.query, it.endQuery);
    if (r) ranges.push({ ...r, id: it.id });
  }
  // Earliest start first; on a tie prefer the longer span.
  ranges.sort((a, b) => a.start - b.start || b.end - a.end);

  const placed = new Set<string>();
  const segments: Segment[] = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start < cursor) continue; // overlaps an already-placed range
    if (r.start > cursor) segments.push({ text: pageText.slice(cursor, r.start) });
    segments.push({ text: pageText.slice(r.start, r.end), itemId: r.id });
    placed.add(r.id);
    cursor = r.end;
  }
  if (cursor < pageText.length) segments.push({ text: pageText.slice(cursor) });
  return { segments, placed };
}
