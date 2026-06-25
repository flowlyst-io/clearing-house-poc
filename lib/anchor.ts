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

export interface AnchorItem {
  id: string;
  /** The verbatim anchor, or a sourceText prefix as fallback. */
  query: string;
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
    const r = locate(pageText, it.query);
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
