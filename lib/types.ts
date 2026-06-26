// Core data model shared by the client store and the API routes.

export type SectionStatus = "confirmed" | "flagged";

export interface ParsedSection {
  /** Key into TAXONOMY. */
  taxonomyKey: string;
  /** Concise, scannable value — what Compare summarizes (e.g. "5 days"). */
  extractedValue: string;
  /** Verbatim contract language — the "source one click away". */
  sourceText: string;
  /** Model's confidence, 0–1. Low confidence drives the Review queue. */
  confidence: number;
  /** "flagged" = needs a human; "confirmed" = a person signed off (or high-confidence seed). */
  status: SectionStatus;
  /** Why it was flagged, or a reviewer's note. */
  note?: string;
  /** Best-effort source page, if known. */
  page?: number;
}

/** Content the parser found but couldn't confidently place in the taxonomy. */
export interface UnmatchedSection {
  /** The heading/label as it appeared in the contract. */
  label: string;
  /** The text, so a reviewer can read it and assign a taxonomy slot. */
  sourceText: string;
}

export type DistrictSource = "seed" | "parsed";

export interface District {
  id: string;
  name: string;
  /** Contract term, e.g. "2023–2027". */
  term?: string;
  source: DistrictSource;
  sections: ParsedSection[];
  /** Surfaced in Review so nothing fails silently. */
  unmatched?: UnmatchedSection[];
  /** Until every flagged section is resolved, a district is "in review". */
  inPool: boolean;
  /**
   * Verbatim text extracted from the uploaded PDF — the audit trail / re-parse
   * source. Absent on seed districts, and omitted from the districts list
   * payload (it can be 100KB+); fetch a single district to load it.
   */
  rawText?: string;
  createdAt: number;
}

/** Shape returned by POST /api/parse (before we attach an id / pool status). */
export interface ParseResult {
  districtName: string;
  term?: string;
  sections: ParsedSection[];
  unmatched: UnmatchedSection[];
}

/** Shape returned by POST /api/summarize. */
export interface SummaryResult {
  taxonomyKey: string;
  /** One- or two-sentence synthesis across the selected districts. */
  synthesis: string;
  /** Present when the section's value is numeric/money/percent. */
  stats?: {
    min: { districtId: string; display: string };
    max: { districtId: string; display: string };
    median: { display: string };
  };
}
