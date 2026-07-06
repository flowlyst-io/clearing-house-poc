"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader2, Check, Sparkles } from "lucide-react";
import { extractPdfText } from "@/lib/pdf";
import {
  startParse,
  useParseJob,
  dismissJob,
  retry,
  PARSE_STEPS,
} from "@/lib/parseJob";
import { SAMPLE_DISTRICT_NAME, SAMPLE_PAGES, SAMPLE_TEXT } from "@/lib/sample";

// Only the local extraction lifecycle lives here now; the long-running parse
// (and its progress) lives in lib/parseJob so it survives navigation.
type Phase = "idle" | "extracting" | "ready" | "error";

export default function UploadPage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [districtName, setDistrictName] = useState("");
  const [text, setText] = useState("");
  // Per-page text from the PDF/sample (null when the user pasted text instead).
  const [pages, setPages] = useState<string[] | null>(null);
  const [meta, setMeta] = useState<{ pages?: number; chars: number }>({ chars: 0 });
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(
    null,
  );

  // The parse now lives in the module store (survives navigation). On remount
  // mid-parse this seeds from the live job, so the stepper reappears.
  const job = useParseJob();
  const parsing = job?.phase === "parsing";

  // Auto-navigate to Review only while the user is still on Upload when the
  // parse finishes. Elsewhere the Sidebar shows a clickable "ready" pill. The
  // effect lives here (not in the store) so it can only fire from a mounted
  // Upload page; dismissJob() first clears the job to prevent a double push.
  useEffect(() => {
    if (job?.phase === "done" && job.resultId) {
      const id = job.resultId;
      dismissJob();
      router.push(`/review?d=${id}`);
    }
  }, [job?.phase, job?.resultId, router]);

  async function handleFile(file: File) {
    setError(null);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError({
        message: "Please choose a PDF, or paste the contract text below.",
        retryable: false,
      });
      return;
    }
    if (!districtName) {
      setDistrictName(file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " "));
    }
    setPhase("extracting");
    try {
      const { pages: extracted } = await extractPdfText(file);
      const combined = extracted.join("\n\n");
      setPages(extracted);
      setText(combined);
      setMeta({ pages: extracted.length, chars: combined.length });
      setPhase("ready");
    } catch (e) {
      setError({
        message:
          (e instanceof Error ? e.message : "Could not read the PDF") +
          " — you can paste the text instead.",
        retryable: false,
      });
      setPhase("error");
    }
  }

  function loadSample() {
    setError(null);
    setPhase("extracting");
    // A brief beat so the action reads as "extracting", then ready.
    setTimeout(() => {
      setDistrictName(SAMPLE_DISTRICT_NAME);
      setPages(SAMPLE_PAGES);
      setText(SAMPLE_TEXT);
      setMeta({ pages: SAMPLE_PAGES.length, chars: SAMPLE_TEXT.length });
      setPhase("ready");
    }, 650);
  }

  // Fire-and-forget into the module store; progress + save + navigation are
  // handled there and via the effect above. Extraction stays local.
  function parse() {
    setError(null);
    startParse({ text, pages, districtName });
  }

  const canParse = text.trim().length >= 120 && !parsing;

  return (
    <div className="max-w-[680px]">
      <h1 className="font-display text-[28px] font-semibold tracking-[-0.3px] text-[var(--color-ink-deep)]">
        Add a contract
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-[#51607a]">
        Drop a PDF — the text is pulled out in your browser, so the file stays on
        your machine. Only the text goes to the parser. No PDF? Paste the text, or
        load a sample.
      </p>

      {/* Dropzone */}
      <div
        onClick={() => !parsing && fileInput.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        className={`mt-6 cursor-pointer rounded-[14px] border-2 border-dashed p-8 text-center transition-colors ${
          phase === "extracting"
            ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
            : "border-[#d2dae6] bg-[var(--color-surface)] hover:border-[var(--color-accent)]"
        }`}
      >
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
          {phase === "extracting" ? (
            <Loader2 size={22} className="animate-spin" />
          ) : (
            <UploadCloud size={22} strokeWidth={1.9} />
          )}
        </span>
        <p className="mt-3 text-[15px] font-medium text-[var(--color-ink)]">
          {phase === "extracting"
            ? "Extracting text…"
            : "Drop a contract PDF here, or click to choose"}
        </p>
        {meta.chars > 0 && phase !== "extracting" ? (
          <p className="mt-1 text-[13px] text-[var(--color-muted)]">
            Extracted {meta.chars.toLocaleString()} characters
            {meta.pages ? ` · ${meta.pages} pages` : ""}
          </p>
        ) : (
          phase !== "extracting" && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                loadSample();
              }}
              className="mt-1 text-[13px] font-medium text-[var(--color-accent)] hover:underline"
            >
              or load a sample contract
            </button>
          )
        )}
      </div>

      <div className="mt-6">
        <label className="text-[13px] font-semibold text-[var(--color-ink)]">
          District name
        </label>
        <input
          value={districtName}
          onChange={(e) => setDistrictName(e.target.value)}
          placeholder="e.g. Cohoes City School District"
          className="mt-1.5 w-full rounded-lg border border-[#dde3ec] bg-[var(--color-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
        />
      </div>

      <div className="mt-5">
        <label className="text-[13px] font-semibold text-[var(--color-ink)]">
          Contract text{" "}
          <span className="font-normal text-[var(--color-muted)]">
            (extracted from the PDF, or paste it here)
          </span>
        </label>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPages(null); // manual edit → treat as a single pasted page
            setMeta({ chars: e.target.value.length });
            if (phase === "idle" || phase === "error") setPhase("ready");
          }}
          rows={8}
          placeholder="Paste the collective bargaining agreement text here…"
          className="font-display mt-1.5 w-full rounded-lg border border-[#dde3ec] bg-[var(--color-surface)] px-3 py-2.5 text-[13.5px] leading-relaxed outline-none focus:border-[var(--color-accent)]"
        />
      </div>

      {/* Extraction errors (non-PDF, unreadable PDF) — local, not retryable. */}
      {error && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-[var(--color-flag-soft)] px-3 py-2 text-sm text-[var(--color-flag)]">
          <span>{error.message}</span>
          {error.retryable && (
            <button
              onClick={parse}
              disabled={parsing}
              className="shrink-0 rounded-md border border-[var(--color-flag)] px-2 py-1 text-xs font-medium hover:bg-white/40 disabled:opacity-40"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Parse/save errors from the module store — retry re-runs the last parse. */}
      {job?.phase === "error" && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-[var(--color-flag-soft)] px-3 py-2 text-sm text-[var(--color-flag)]">
          <span>{job.error}</span>
          {job.retryable && (
            <button
              onClick={retry}
              disabled={parsing}
              className="shrink-0 rounded-md border border-[var(--color-flag)] px-2 py-1 text-xs font-medium hover:bg-white/40 disabled:opacity-40"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Parse progress — driven by the module store so it resumes on remount */}
      {parsing ? (
        <div className="mt-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[0_1px_2px_rgba(16,27,48,.04)]">
          <div className="space-y-3">
            {PARSE_STEPS.map((label, i) => {
              const step = job?.step ?? 0;
              const state = i < step ? "done" : i === step ? "active" : "pending";
              return (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span
                    className={`grid h-5 w-5 place-items-center rounded-full ${
                      state === "done"
                        ? "bg-[var(--color-ok)] text-white"
                        : state === "active"
                          ? "text-[var(--color-accent)]"
                          : "text-[var(--color-line)]"
                    }`}
                  >
                    {state === "done" ? (
                      <Check size={13} strokeWidth={3} />
                    ) : state === "active" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-current" />
                    )}
                  </span>
                  <span
                    className={
                      state === "pending"
                        ? "text-[var(--color-muted)]"
                        : "text-[var(--color-ink)]"
                    }
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <button
            onClick={parse}
            disabled={!canParse}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(36,86,201,.28)] disabled:opacity-40"
          >
            <Sparkles size={16} strokeWidth={2} /> Parse contract
          </button>
        </div>
      )}
    </div>
  );
}
