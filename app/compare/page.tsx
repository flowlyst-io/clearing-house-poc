"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useDistricts } from "@/lib/store";
import { TAXONOMY, TAXONOMY_BY_KEY } from "@/lib/taxonomy";
import type { TaxonomySection } from "@/lib/taxonomy";
import type { District, ParsedSection } from "@/lib/types";
import {
  parseNumeric,
  formatValue,
  median,
  highlightNumbers,
} from "@/lib/values";

const DEFAULT_SECTIONS = ["bereavement", "sick_leave", "salary_schedule"];

interface SummaryState {
  loading: boolean;
  text: string;
  error: string | null;
}

export default function ComparePage() {
  const districts = useDistricts();
  const pool = useMemo(() => districts.filter((d) => d.inPool), [districts]);

  // Both sections and districts are now multi-select.
  const [sectionKeys, setSectionKeys] = useState<Set<string>>(
    new Set(DEFAULT_SECTIONS),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<{
    district: District;
    section: ParsedSection;
  } | null>(null);

  // Keep district selection sensible as the pool changes (auto-select arrivals,
  // preserve deliberate deselections — StrictMode-safe: ref written in the effect
  // body, not inside the setState updater).
  const seenIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const ids = pool.map((d) => d.id);
    const known = seenIds.current;
    const newly = ids.filter((id) => !known.has(id));
    seenIds.current = new Set(ids);
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => ids.includes(id)));
      newly.forEach((id) => next.add(id));
      if (next.size === 0) ids.forEach((id) => next.add(id));
      return next;
    });
  }, [pool]);

  const chosen = pool.filter((d) => selected.has(d.id));
  // Render rows in canonical taxonomy order, not click order — stable & scannable.
  const sections = TAXONOMY.filter((s) => sectionKeys.has(s.key));

  function toggle(set: Set<string>, id: string): Set<string> {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  }

  // ---- AI summaries, one per section row, fetched on demand and cached ----
  const [summaries, setSummaries] = useState<Record<string, SummaryState>>({});
  const fetched = useRef<Set<string>>(new Set());
  const selectedIdsKey = [...selected].sort().join(",");

  function rowFor(d: District, key: string): ParsedSection | null {
    return d.sections.find((s) => s.taxonomyKey === key) ?? null;
  }

  useEffect(() => {
    let cancelled = false;
    const sortedIds = [...selected].sort();
    for (const sec of sections) {
      const items = chosen
        .map((d) => ({ d, sec: rowFor(d, sec.key) }))
        .filter((x) => x.sec)
        .map((x) => ({ districtName: x.d.name, value: x.sec!.extractedValue }));
      if (items.length < 2) continue;
      const key = `${sec.key}|${sortedIds.join(",")}`;
      if (fetched.current.has(key)) continue;
      fetched.current.add(key);
      setSummaries((s) => ({ ...s, [key]: { loading: true, text: "", error: null } }));
      fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxonomyKey: sec.key, items }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Summary failed");
          if (!cancelled)
            setSummaries((s) => ({
              ...s,
              [key]: { loading: false, text: data.synthesis, error: null },
            }));
        })
        .catch((e) => {
          fetched.current.delete(key); // allow retry on next change
          if (!cancelled)
            setSummaries((s) => ({
              ...s,
              [key]: {
                loading: false,
                text: "",
                error: e instanceof Error ? e.message : "Summary failed",
              },
            }));
        });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [[...sectionKeys].sort().join(","), selectedIdsKey, districts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Compare districts</h1>
          <p className="text-sm text-[var(--color-muted)]">
            Pick one or more sections and districts. Click any value to read the
            source language.
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

      {/* Section multi-select */}
      <Picker
        label="Sections"
        count={`${sections.length}/${TAXONOMY.length}`}
        onAll={() => setSectionKeys(new Set(TAXONOMY.map((s) => s.key)))}
        onClear={() => setSectionKeys(new Set())}
      >
        {TAXONOMY.map((s) => (
          <Chip
            key={s.key}
            active={sectionKeys.has(s.key)}
            activeClass="border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
            onClick={() => setSectionKeys((prev) => toggle(prev, s.key))}
          >
            {s.label}
          </Chip>
        ))}
      </Picker>

      {/* District multi-select */}
      {pool.length > 0 && (
        <Picker
          label="Districts"
          count={`${chosen.length}/${pool.length}`}
          onAll={() => setSelected(new Set(pool.map((d) => d.id)))}
          onClear={() => setSelected(new Set())}
        >
          {pool.map((d) => (
            <Chip
              key={d.id}
              active={selected.has(d.id)}
              activeClass="border-[var(--color-ink)] bg-[var(--color-ink)] text-white"
              onClick={() => setSelected((prev) => toggle(prev, d.id))}
            >
              {d.name}
            </Chip>
          ))}
        </Picker>
      )}

      {/* Matrix */}
      {sections.length === 0 || chosen.length === 0 ? (
        <p className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-muted)]">
          {sections.length === 0
            ? "Select at least one section above."
            : "Select at least one district above."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)]">
                <th className="sticky left-0 z-10 bg-[var(--color-surface)] px-4 py-3 text-left font-medium">
                  Section
                </th>
                {chosen.map((d) => (
                  <th
                    key={d.id}
                    className="min-w-44 px-4 py-3 text-left align-bottom font-semibold"
                  >
                    {d.name}
                    {d.term && (
                      <div className="text-xs font-normal text-[var(--color-muted)]">
                        {d.term}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sections.map((sec) => (
                <SectionRow
                  key={sec.key}
                  section={sec}
                  districts={chosen}
                  rowFor={rowFor}
                  summary={summaries[`${sec.key}|${selectedIdsKey}`]}
                  onOpen={(district, section) => setDrawer({ district, section })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {drawer && (
        <SourceDrawer
          districtName={drawer.district.name}
          sectionLabel={TAXONOMY_BY_KEY[drawer.section.taxonomyKey]?.label ?? ""}
          section={drawer.section}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}

function SectionRow({
  section,
  districts,
  rowFor,
  summary,
  onOpen,
}: {
  section: TaxonomySection;
  districts: District[];
  rowFor: (d: District, key: string) => ParsedSection | null;
  summary?: SummaryState;
  onOpen: (d: District, s: ParsedSection) => void;
}) {
  const cells = districts.map((d) => ({ d, sec: rowFor(d, section.key) }));

  // Per-row stats from numeric values.
  const stats = (() => {
    if (section.valueKind === "text") return null;
    const nums = cells
      .filter((c) => c.sec)
      .map((c) => parseNumeric(section.valueKind, c.sec!.extractedValue))
      .filter((n): n is number => n !== null);
    if (nums.length < 2) return null;
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    return `${formatValue(section.valueKind, min)}–${formatValue(
      section.valueKind,
      max,
    )} · median ${formatValue(section.valueKind, median(nums))}`;
  })();

  const colSpan = districts.length + 1;

  return (
    <>
      <tr className="border-t border-[var(--color-line)] align-top">
        <th className="sticky left-0 z-10 bg-[var(--color-surface)] px-4 py-3 text-left">
          <div className="font-semibold">{section.label}</div>
          {stats && (
            <div className="mt-0.5 text-xs font-normal text-[var(--color-muted)]">
              {stats}
            </div>
          )}
        </th>
        {cells.map(({ d, sec }) => (
          <td key={d.id} className="px-4 py-3">
            {sec ? (
              <button
                onClick={() => onOpen(d, sec)}
                className="text-left hover:underline"
                title="View source language"
              >
                <span className="font-medium">
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
                </span>
                {sec.status === "flagged" && (
                  <span className="ml-1 align-middle text-[11px] font-medium text-[var(--color-flag)]">
                    ⚑
                  </span>
                )}
              </button>
            ) : (
              <span className="text-[var(--color-muted)]">—</span>
            )}
          </td>
        ))}
      </tr>
      <tr className="bg-[var(--color-accent-soft)]/40">
        <td
          colSpan={colSpan}
          className="px-4 pb-3 text-sm text-[var(--color-muted)]"
        >
          <span className="font-medium text-[var(--color-accent)]">
            AI summary{" "}
          </span>
          {!summary ? (
            <span>select two or more districts with this section.</span>
          ) : summary.loading ? (
            <span>reading the values…</span>
          ) : summary.error ? (
            <span className="text-[var(--color-flag)]">{summary.error}</span>
          ) : (
            <span>{summary.text}</span>
          )}
        </td>
      </tr>
    </>
  );
}

function Picker({
  label,
  count,
  onAll,
  onClear,
  children,
}: {
  label: string;
  count: string;
  onAll: () => void;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
          {label} ({count})
        </label>
        <button
          onClick={onAll}
          className="text-xs text-[var(--color-accent)] hover:underline"
        >
          All
        </button>
        <button
          onClick={onClear}
          className="text-xs text-[var(--color-muted)] hover:underline"
        >
          Clear
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  activeClass,
  onClick,
  children,
}: {
  active: boolean;
  activeClass: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
        active
          ? activeClass
          : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:bg-[var(--color-canvas)]"
      }`}
    >
      {children}
    </button>
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
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
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
