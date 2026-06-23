"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useDistricts } from "@/lib/store";
import { TAXONOMY, TAXONOMY_BY_KEY } from "@/lib/taxonomy";
import type { District, ParsedSection } from "@/lib/types";
import {
  parseNumeric,
  formatValue,
  median,
  highlightNumbers,
} from "@/lib/values";

export default function ComparePage() {
  const districts = useDistricts();
  const pool = useMemo(() => districts.filter((d) => d.inPool), [districts]);

  const [sectionKey, setSectionKey] = useState("bereavement");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<{
    district: District;
    section: ParsedSection;
  } | null>(null);

  // Keep the selection sensible as the pool changes: drop districts that left,
  // auto-select any that newly arrived (e.g. a contract just confirmed in Review),
  // and select everything on first load — while preserving deliberate deselections.
  const seenIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const ids = pool.map((d) => d.id);
    // Compute "newly arrived" and update the ref here in the effect body — NOT
    // inside the setState updater, which StrictMode double-invokes (a ref write
    // there would make the updater impure and drop the new district).
    const known = seenIds.current;
    const newly = ids.filter((id) => !known.has(id));
    seenIds.current = new Set(ids);
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => ids.includes(id)));
      newly.forEach((id) => next.add(id)); // auto-select arrivals (incl. first load)
      if (next.size === 0) ids.forEach((id) => next.add(id));
      return next;
    });
  }, [pool]);

  const section = TAXONOMY_BY_KEY[sectionKey];
  const chosen = pool.filter((d) => selected.has(d.id));

  // For each chosen district, the section row (may be missing).
  const rows = chosen.map((d) => ({
    district: d,
    section: d.sections.find((s) => s.taxonomyKey === sectionKey) ?? null,
  }));

  // Deterministic stats — computed here, never by the model.
  const stats = useMemo(() => {
    if (section.valueKind === "text") return null;
    const points = rows
      .filter((r) => r.section)
      .map((r) => ({
        name: r.district.name,
        n: parseNumeric(section.valueKind, r.section!.extractedValue),
      }))
      .filter((p): p is { name: string; n: number } => p.n !== null);
    if (points.length < 2) return null;
    const sorted = [...points].sort((a, b) => a.n - b.n);
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      med: median(points.map((p) => p.n)),
      kind: section.valueKind,
    };
  }, [rows, section]);

  // AI synthesis sentence.
  const [synthesis, setSynthesis] = useState<{
    loading: boolean;
    text: string;
    error: string | null;
  }>({ loading: false, text: "", error: null });

  useEffect(() => {
    const items = rows
      .filter((r) => r.section)
      .map((r) => ({
        districtName: r.district.name,
        value: r.section!.extractedValue,
      }));
    if (items.length < 2) {
      setSynthesis({ loading: false, text: "", error: null });
      return;
    }
    let cancelled = false;
    setSynthesis({ loading: true, text: "", error: null });
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taxonomyKey: sectionKey, items }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "Summary failed");
        setSynthesis({ loading: false, text: data.synthesis, error: null });
      } catch (e) {
        if (cancelled) return;
        setSynthesis({
          loading: false,
          text: "",
          error: e instanceof Error ? e.message : "Summary failed",
        });
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionKey, JSON.stringify([...selected]), districts]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Compare districts</h1>
          <p className="text-sm text-[var(--color-muted)]">
            Pick a section and the districts to compare. Click any value to read
            the source language.
          </p>
        </div>
        {pool.length === 0 && (
          <Link
            href="/upload"
            className="rounded-md bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-white"
          >
            Add a contract to compare →
          </Link>
        )}
      </div>

      {/* Section selector */}
      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
          Section
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TAXONOMY.map((s) => (
            <button
              key={s.key}
              onClick={() => setSectionKey(s.key)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                s.key === sectionKey
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                  : "border-[var(--color-line)] bg-[var(--color-surface)] hover:bg-[var(--color-canvas)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* District selector */}
      {pool.length > 0 && (
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
            Districts ({chosen.length}/{pool.length})
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pool.map((d) => (
              <button
                key={d.id}
                onClick={() => toggle(d.id)}
                className={`rounded-md border px-3 py-1 text-sm transition-colors ${
                  selected.has(d.id)
                    ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-white"
                    : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:bg-[var(--color-canvas)]"
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">{section.label}</h2>
          <span className="text-sm text-[var(--color-muted)]">
            — {section.description}
          </span>
        </div>

        {stats ? (
          <div className="mt-4 grid grid-cols-3 gap-3 sm:max-w-md">
            <Stat
              label="Lowest"
              value={formatValue(stats.kind, stats.min.n)}
              sub={stats.min.name}
            />
            <Stat label="Median" value={formatValue(stats.kind, stats.med)} />
            <Stat
              label="Highest"
              value={formatValue(stats.kind, stats.max.n)}
              sub={stats.max.name}
            />
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-muted)]">
            {section.valueKind === "text"
              ? "This section compares best by reading the language — see the cards below."
              : "Select at least two districts that have this section to see min / median / max."}
          </p>
        )}

        <div className="mt-4 rounded-lg bg-[var(--color-accent-soft)] p-3 text-sm">
          <span className="font-medium text-[var(--color-accent)]">
            AI summary{" "}
          </span>
          {synthesis.loading ? (
            <span className="text-[var(--color-muted)]">reading the values…</span>
          ) : synthesis.error ? (
            <span className="text-[var(--color-flag)]">{synthesis.error}</span>
          ) : synthesis.text ? (
            <span>{synthesis.text}</span>
          ) : (
            <span className="text-[var(--color-muted)]">
              Select two or more districts to generate a summary.
            </span>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ district, section: sec }) => (
          <div
            key={district.id}
            className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5"
          >
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold">{district.name}</h3>
              {district.term && (
                <span className="text-xs text-[var(--color-muted)]">
                  {district.term}
                </span>
              )}
            </div>

            {sec ? (
              <>
                <div className="mt-3 text-lg font-semibold leading-snug">
                  {highlightNumbers(sec.extractedValue).map((p, i) =>
                    p.isNumber ? (
                      <span
                        key={i}
                        className="rounded bg-[var(--color-accent-soft)] px-1 text-[var(--color-accent)]"
                      >
                        {p.text}
                      </span>
                    ) : (
                      <span key={i}>{p.text}</span>
                    ),
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {sec.status === "flagged" && (
                    <span className="rounded bg-[var(--color-flag-soft)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-flag)]">
                      needs review
                    </span>
                  )}
                  <button
                    onClick={() => setDrawer({ district, section: sec })}
                    className="text-sm font-medium text-[var(--color-accent)] hover:underline"
                  >
                    View source language →
                  </button>
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-[var(--color-muted)]">
                Not found in this contract.
              </p>
            )}
          </div>
        ))}
        {chosen.length === 0 && pool.length > 0 && (
          <p className="text-sm text-[var(--color-muted)]">
            Select one or more districts above.
          </p>
        )}
      </div>

      {drawer && (
        <SourceDrawer
          districtName={drawer.district.name}
          sectionLabel={section.label}
          section={drawer.section}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-line)] p-3">
      <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-semibold">{value}</div>
      {sub && <div className="text-xs text-[var(--color-muted)]">{sub}</div>}
    </div>
  );
}

function SourceDrawer({
  districtName,
  sectionLabel,
  section,
  onClose,
}: {
  districtName: string;
  sectionLabel: string;
  section: ParsedSection;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative h-full w-full max-w-md overflow-y-auto border-l border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
              {districtName}
            </div>
            <h3 className="text-lg font-semibold">{sectionLabel}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-[var(--color-muted)] hover:bg-[var(--color-canvas)]"
          >
            Close
          </button>
        </div>

        <div className="mt-4">
          <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
            Extracted value
          </div>
          <div className="mt-1 text-base font-semibold">
            {section.extractedValue}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--color-muted)]">
            Source language
            {typeof section.page === "number" && <span>· p.{section.page}</span>}
          </div>
          <p className="mt-1 whitespace-pre-wrap rounded-lg bg-[var(--color-canvas)] p-3 text-sm leading-relaxed">
            {section.sourceText || "No source text captured."}
          </p>
        </div>

        <div className="mt-4 text-xs text-[var(--color-muted)]">
          Confidence: {Math.round(section.confidence * 100)}% · Status:{" "}
          {section.status}
        </div>
      </div>
    </div>
  );
}
