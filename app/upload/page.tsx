"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { extractPdfText } from "@/lib/pdf";
import { addDistrict } from "@/lib/store";
import type { District, ParseResult } from "@/lib/types";

type Phase = "idle" | "extracting" | "ready" | "parsing" | "error";

export default function UploadPage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [districtName, setDistrictName] = useState("");
  const [text, setText] = useState("");
  // Per-page text from the PDF (null when the user pasted text instead).
  const [pages, setPages] = useState<string[] | null>(null);
  const [meta, setMeta] = useState<{ pages?: number; chars: number }>({
    chars: 0,
  });
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(
    null,
  );

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
      // Pre-fill a reasonable name from the filename.
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

  async function parse() {
    setError(null);
    setPhase("parsing");
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, districtName: districtName || undefined }),
      });
      const data = (await res.json()) as ParseResult & {
        error?: string;
        retryable?: boolean;
      };
      if (!res.ok) {
        setError({
          message: data.error || "Parse failed",
          retryable: !!data.retryable,
        });
        setPhase("error");
        return;
      }

      const district: District = {
        id: `parsed-${Date.now()}`,
        name: data.districtName,
        term: data.term,
        source: "parsed",
        sections: data.sections,
        unmatched: data.unmatched,
        // Persist the document text for the Review reader. PDF → per-page;
        // pasted text → a single page.
        pages: pages && pages.length ? pages : [text],
        inPool: false, // enters the pool only after a human confirms in Review
        createdAt: Date.now(),
      };
      try {
        addDistrict(district);
      } catch (storeErr) {
        // Out of localStorage space — honest message, not "couldn't reach parser".
        setError({
          message:
            storeErr instanceof Error
              ? storeErr.message
              : "Couldn't save the contract locally.",
          retryable: false,
        });
        setPhase("error");
        return;
      }
      router.push(`/review?d=${district.id}`);
    } catch {
      // fetch threw before any response — almost always transient/network.
      setError({
        message: "Couldn't reach the parser. Check your connection and try again.",
        retryable: true,
      });
      setPhase("error");
    }
  }

  const canParse = text.trim().length >= 200 && phase !== "parsing";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Add a contract</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Drop a PDF — the text is pulled out in your browser, so the file stays
          on your machine. Only the text goes to the parser. No PDF? Paste the
          text instead.
        </p>
      </div>

      {/* Dropzone */}
      <div
        onClick={() => fileInput.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        className="cursor-pointer rounded-xl border-2 border-dashed border-[var(--color-line)] bg-[var(--color-surface)] p-8 text-center transition-colors hover:border-[var(--color-accent)]"
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
        <p className="font-medium">
          {phase === "extracting"
            ? "Reading the PDF…"
            : "Drop a contract PDF here, or click to choose"}
        </p>
        {meta.chars > 0 && phase !== "extracting" && (
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Extracted {meta.pages ? `${meta.pages} pages, ` : ""}
            {meta.chars.toLocaleString()} characters
          </p>
        )}
      </div>

      <div>
        <label className="text-sm font-medium">District name</label>
        <input
          value={districtName}
          onChange={(e) => setDistrictName(e.target.value)}
          placeholder="e.g. Cohoes City School District"
          className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
      </div>

      <div>
        <label className="text-sm font-medium">
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
          className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-[var(--color-accent)]"
        />
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-md bg-[var(--color-flag-soft)] px-3 py-2 text-sm text-[var(--color-flag)]">
          <span>{error.message}</span>
          {error.retryable && (
            <button
              onClick={parse}
              disabled={phase === "parsing"}
              className="shrink-0 rounded-md border border-[var(--color-flag)] px-2 py-1 text-xs font-medium hover:bg-white/40 disabled:opacity-40"
            >
              Retry
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={parse}
          disabled={!canParse}
          className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {phase === "parsing" ? "Parsing…" : "Parse contract"}
        </button>
        {phase === "parsing" && (
          <span className="text-sm text-[var(--color-muted)]">
            AI is reading the whole contract and pulling out each section — this
            can take up to a minute.
          </span>
        )}
      </div>
    </div>
  );
}
