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
  const [meta, setMeta] = useState<{ pages?: number; chars: number }>({
    chars: 0,
  });
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setError("");
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF, or paste the contract text below.");
      return;
    }
    if (!districtName) {
      // Pre-fill a reasonable name from the filename.
      setDistrictName(file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " "));
    }
    setPhase("extracting");
    try {
      const { text: extracted, pages } = await extractPdfText(file);
      setText(extracted);
      setMeta({ pages, chars: extracted.length });
      setPhase("ready");
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : "Could not read the PDF") +
          " — you can paste the text instead.",
      );
      setPhase("error");
    }
  }

  async function parse() {
    setError("");
    setPhase("parsing");
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, districtName: districtName || undefined }),
      });
      const data = (await res.json()) as ParseResult & { error?: string };
      if (!res.ok) throw new Error(data.error || "Parse failed");

      const district: District = {
        id: `parsed-${Date.now()}`,
        name: data.districtName,
        term: data.term,
        source: "parsed",
        sections: data.sections,
        unmatched: data.unmatched,
        inPool: false, // enters the pool only after a human confirms in Review
        createdAt: Date.now(),
      };
      addDistrict(district);
      router.push(`/review?d=${district.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parse failed");
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
            setMeta({ chars: e.target.value.length });
            if (phase === "idle" || phase === "error") setPhase("ready");
          }}
          rows={8}
          placeholder="Paste the collective bargaining agreement text here…"
          className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-[var(--color-accent)]"
        />
      </div>

      {error && (
        <div className="rounded-md bg-[var(--color-flag-soft)] px-3 py-2 text-sm text-[var(--color-flag)]">
          {error}
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
