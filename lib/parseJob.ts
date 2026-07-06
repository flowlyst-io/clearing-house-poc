"use client";

import { useEffect, useState } from "react";
import { addDistrict } from "./store";
import type { District, ParseResult } from "./types";

// The parse of a contract can take minutes (the /api/parse route sets
// maxDuration = 300). If that progress lived in the Upload page's component
// state it would vanish the moment the user navigated away — which is exactly
// the bug this module fixes. Instead the whole parse lifecycle (the fetch, the
// save, and the presentational step ticker) lives here at module scope, so it
// survives navigation. Any mounted useParseJob() re-reads it on the EVT event,
// letting the Upload stepper AND a global Sidebar pill show the same live state.
//
// Mirrors lib/store.ts: module-scoped state + a custom window event + a
// seed-and-subscribe hook. Server-safe (all window access is guarded).

// The presentational steps shown while a parse is in flight. Single source of
// truth — imported by both the Upload page and the Sidebar pill.
export const PARSE_STEPS = [
  "Reading the contract text…",
  "Splitting into standardized sections…",
  "Extracting comparable values…",
  "Flagging low-confidence sections…",
];

export type ParsePhase = "parsing" | "done" | "error";

export interface ParseJob {
  id: string;
  districtName: string;
  phase: ParsePhase;
  step: number; // 0..PARSE_STEPS.length-1 — presentational only
  error?: string;
  retryable?: boolean;
  resultId?: string; // District.id, set once phase === "done"
}

export interface ParseInput {
  text: string;
  pages: string[] | null;
  districtName: string;
}

const EVT = "clearinghouse:parse-changed";

// Single active/most-recent job (latest-wins). Kept at module scope so it
// outlives the Upload component that started it.
let job: ParseJob | null = null;
// Retained so retry() works without the Upload page holding the inputs in a
// live closure (it may be unmounted by the time the user hits Retry).
let lastInput: ParseInput | null = null;
let stepTimer: ReturnType<typeof setInterval> | null = null;

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVT));
}

function setJob(next: ParseJob | null) {
  job = next;
  notify();
}

// The step ticker lives in a plain module function (not a useEffect), so React
// StrictMode can't double-start it. Idempotent: clears any existing timer first.
function startStepTimer() {
  stopStepTimer();
  stepTimer = setInterval(() => {
    if (!job || job.phase !== "parsing") return;
    setJob({ ...job, step: Math.min(job.step + 1, PARSE_STEPS.length - 1) });
  }, 700);
}

function stopStepTimer() {
  if (stepTimer) {
    clearInterval(stepTimer);
    stepTimer = null;
  }
}

export function getParseJob(): ParseJob | null {
  return job;
}

/**
 * Kick off a parse. Fire-and-forget by design — callers MUST NOT await this or
 * tie a component's lifecycle to it. The work continues in the module even after
 * the Upload page unmounts.
 */
export function startParse(input: ParseInput): void {
  lastInput = input;
  const id = `job-${Date.now()}`;
  setJob({
    id,
    districtName: input.districtName || "contract",
    phase: "parsing",
    step: 0,
  });
  startStepTimer();
  void run(id, input);
}

async function run(jobId: string, input: ParseInput): Promise<void> {
  // Drop any write once this job has been superseded (latest-wins) or dismissed.
  const stale = () => !job || job.id !== jobId;

  try {
    const res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: input.text,
        districtName: input.districtName || undefined,
      }),
    });
    const data = (await res.json()) as ParseResult & {
      error?: string;
      retryable?: boolean;
    };
    if (stale()) return;

    if (!res.ok) {
      stopStepTimer();
      setJob({
        ...job!,
        phase: "error",
        error: data.error || "Parse failed",
        retryable: !!data.retryable,
      });
      return;
    }

    const district: District = {
      id: `parsed-${Date.now()}`,
      name: data.districtName,
      term: data.term,
      source: "parsed",
      sections: data.sections,
      unmatched: data.unmatched,
      // Document text for the Review reader. PDF/sample → per-page; pasted → one page.
      pages: input.pages && input.pages.length ? input.pages : [input.text],
      inPool: false,
      createdAt: Date.now(),
    };

    try {
      await addDistrict(district);
    } catch (storeErr) {
      if (stale()) return;
      stopStepTimer();
      setJob({
        ...job!,
        phase: "error",
        error:
          (storeErr instanceof Error ? storeErr.message : "Couldn't save the contract") +
          " — your parse succeeded; try saving again.",
        retryable: true,
      });
      return;
    }

    if (stale()) return;
    stopStepTimer();
    setJob({ ...job!, phase: "done", resultId: district.id });
  } catch {
    if (stale()) return;
    stopStepTimer();
    setJob({
      ...job!,
      phase: "error",
      error: "Couldn't reach the parser. Check your connection and try again.",
      retryable: true,
    });
  }
}

/** Re-run the most recent parse (new job, latest-wins). No-op if none. */
export function retry(): void {
  if (lastInput) startParse(lastInput);
}

/** Clear the current job (dismiss the pill / prevent a double auto-navigate). */
export function dismissJob(): void {
  stopStepTimer();
  setJob(null);
}

/** Reactive view of the current parse job. Re-reads on any change. */
export function useParseJob(): ParseJob | null {
  const [state, setState] = useState<ParseJob | null>(getParseJob());

  useEffect(() => {
    const sync = () => setState(getParseJob());
    sync();
    window.addEventListener(EVT, sync);
    return () => window.removeEventListener(EVT, sync);
  }, []);

  return state;
}
