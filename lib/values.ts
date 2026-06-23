import type { ValueKind } from "./taxonomy";

// Pull the leading comparable number out of an extracted value string so Compare
// can compute min / max / median. We deliberately compute stats deterministically
// on the client (not via the model) — a wrong number erodes trust faster than a
// missing feature, per the README. The model only writes the prose synthesis.

export function parseNumeric(kind: ValueKind, value: string): number | null {
  if (kind === "text") return null;
  // Grab the first number, tolerating $ and thousands separators.
  const m = value.replace(/,/g, "").match(/\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

export function formatValue(kind: ValueKind, n: number): string {
  switch (kind) {
    case "money":
      return "$" + n.toLocaleString("en-US");
    case "percent":
      return n + "%";
    default:
      return n.toLocaleString("en-US");
  }
}

export function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Split a string so numeric tokens ($48,000 | 27 | 85%) can be visually
 * highlighted. Returns alternating [text, number, text, number, ...] parts with
 * a flag. Used by Compare to "highlight the key numbers".
 */
export function highlightNumbers(
  text: string,
): { text: string; isNumber: boolean }[] {
  const parts: { text: string; isNumber: boolean }[] = [];
  const re = /(\$?\d[\d,]*(?:\.\d+)?%?)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), isNumber: false });
    parts.push({ text: m[0], isNumber: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), isNumber: false });
  return parts;
}
