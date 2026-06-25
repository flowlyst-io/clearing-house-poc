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
  const [search, setSearch] = useState("");
  const [showAllSections, setShowAllSections] = useState(false);
  const [showAllDistricts, setShowAllDistricts] = useState(false);
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

  // Search only narrows which OPTIONS show in the sidebar — it never changes the
  // selection or what's in the matrix.
  const q = search.trim().toLowerCase();
  const visibleSections = q
    ? TAXONOMY.filter((s) => s.label.toLowerCase().includes(q))
    : TAXONOMY;
  const visibleDistricts = q
    ? pool.filter((d) => d.name.toLowerCase().includes(q))
    : pool;

  function toggle(set: Set<string>, id: string): Set<string> {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  }
  // "All" adds every currently-visible option to the selection (so it respects
  // an active search); "Clear" empties the whole selection.
  function selectAll(prev: Set<string>, ids: string[]): Set<string> {
    const next = new Set(prev);
    ids.forEach((id) => next.add(id));
    return next;
  }

  const selectedIdsKey = [...selected].sort().join(",");

  function rowFor(d: District, key: string): ParsedSection | null {
    return d.sections.find((s) => s.taxonomyKey === key) ?? null;
  }

  // ---- One overall AI summary across everything selected ----
  const [overall, setOverall] = useState<SummaryState>({
    loading: false,
    text: "",
    error: null,
  });
  const fetchedKey = useRef<string | null>(null);
  const sectionKeysKey = [...sectionKeys].sort().join(",");

  function fetchOverall(force = false) {
    // Build the grid: each selected section (taxonomy order) with the value from
    // each chosen district. Skip sections no chosen district has.
    const payloadSections = sections
      .map((sec) => ({
        label: sec.label,
        items: chosen
          .map((d) => ({ d, s: rowFor(d, sec.key) }))
          .filter((x) => x.s)
          .map((x) => ({ districtName: x.d.name, value: x.s!.extractedValue })),
      }))
      .filter((s) => s.items.length > 0);

    const key = `${sectionKeysKey}|${selectedIdsKey}`;
    if (payloadSections.length === 0 || chosen.length === 0) {
      fetchedKey.current = null;
      setOverall({ loading: false, text: "", error: null });
      return;
    }
    if (!force && fetchedKey.current === key) return;
    fetchedKey.current = key;
    setOverall({ loading: true, text: "", error: null });
    fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sections: payloadSections }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn't generate a summary.");
        setOverall({ loading: false, text: data.synthesis, error: null });
      })
      .catch((e) => {
        fetchedKey.current = null; // allow retry
        setOverall({
          loading: false,
          text: "",
          error: e instanceof Error ? e.message : "Couldn't generate a summary.",
        });
      });
  }

  useEffect(() => {
    const t = setTimeout(() => fetchOverall(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionKeysKey, selectedIdsKey, districts]);

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

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left sidebar: search + multi-select filters */}
        <aside className="space-y-5 lg:sticky lg:top-6 lg:max-h-[calc(100vh-5rem)] lg:w-64 lg:shrink-0 lg:self-start lg:overflow-y-auto">
          <div className="relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sections or districts…"
              className="w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 pr-7 text-sm outline-none focus:border-[var(--color-accent)]"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              >
                ×
              </button>
            )}
          </div>

          <FilterList
            label="Sections"
            count={`${sections.length}/${TAXONOMY.length}`}
            onAll={() =>
              setSectionKeys((prev) =>
                selectAll(prev, visibleSections.map((s) => s.key)),
              )
            }
            onClear={() => setSectionKeys(new Set())}
            expanded={showAllSections}
            onToggleExpand={() => setShowAllSections((v) => !v)}
            items={visibleSections.map((s) => ({
              id: s.key,
              label: s.label,
              active: sectionKeys.has(s.key),
              onToggle: () => setSectionKeys((prev) => toggle(prev, s.key)),
            }))}
          />

          {pool.length > 0 && (
            <FilterList
              label="Districts"
              count={`${chosen.length}/${pool.length}`}
              onAll={() =>
                setSelected((prev) =>
                  selectAll(prev, visibleDistricts.map((d) => d.id)),
                )
              }
              onClear={() => setSelected(new Set())}
              expanded={showAllDistricts}
              onToggleExpand={() => setShowAllDistricts((v) => !v)}
              items={visibleDistricts.map((d) => ({
                id: d.id,
                label: d.name,
                active: selected.has(d.id),
                onToggle: () => setSelected((prev) => toggle(prev, d.id)),
              }))}
            />
          )}
        </aside>

        {/* Matrix */}
        <div className="min-w-0 flex-1 space-y-4">
          {/* One overall AI summary across everything selected */}
          {sections.length > 0 && chosen.length > 0 && (
            <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-accent-soft)] p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-[var(--color-accent)]">
                  AI summary
                </span>
                {overall.error && (
                  <button
                    onClick={() => fetchOverall(true)}
                    className="shrink-0 text-xs font-medium text-[var(--color-accent)] underline"
                  >
                    Retry
                  </button>
                )}
              </div>
              <p className="mt-1 leading-relaxed">
                {overall.loading ? (
                  <span className="text-[var(--color-muted)]">
                    reading the values across {sections.length} section
                    {sections.length === 1 ? "" : "s"}…
                  </span>
                ) : overall.error ? (
                  <span className="text-[var(--color-flag)]">{overall.error}</span>
                ) : overall.text ? (
                  overall.text
                ) : (
                  <span className="text-[var(--color-muted)]">
                    Select sections and districts to generate an overview.
                  </span>
                )}
              </p>
            </div>
          )}

          {sections.length === 0 || chosen.length === 0 ? (
            <p className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-muted)]">
              {sections.length === 0
                ? "Select at least one section on the left."
                : "Select at least one district on the left."}
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
                      onOpen={(district, section) =>
                        setDrawer({ district, section })
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

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
  onOpen,
}: {
  section: TaxonomySection;
  districts: District[];
  rowFor: (d: District, key: string) => ParsedSection | null;
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

  return (
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
  );
}

interface FilterItem {
  id: string;
  label: string;
  active: boolean;
  onToggle: () => void;
}

const COLLAPSED_CAP = 5;

// When collapsed, show at most COLLAPSED_CAP rows — but always include every
// selected item (filling the rest with unselected ones, in order) so a checked
// option is never hidden below the fold while its row shows in the matrix.
function capItems(items: FilterItem[], expanded: boolean): FilterItem[] {
  if (expanded) return items;
  const selectedCount = items.filter((i) => i.active).length;
  let fillers = Math.max(COLLAPSED_CAP - selectedCount, 0);
  const out: FilterItem[] = [];
  for (const it of items) {
    if (it.active) out.push(it);
    else if (fillers > 0) {
      out.push(it);
      fillers--;
    }
  }
  return out;
}

function FilterList({
  label,
  count,
  onAll,
  onClear,
  expanded,
  onToggleExpand,
  items,
}: {
  label: string;
  count: string;
  onAll: () => void;
  onClear: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
  items: FilterItem[];
}) {
  const visible = capItems(items, expanded);
  const hidden = items.length - visible.length;

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
          {label} ({count})
        </span>
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
      <div className="mt-1.5 space-y-0.5">
        {items.length === 0 ? (
          <p className="px-2 py-1 text-xs text-[var(--color-muted)]">
            No matches.
          </p>
        ) : (
          visible.map((it) => <CheckRow key={it.id} item={it} />)
        )}
      </div>
      {(hidden > 0 || expanded) && (
        <button
          onClick={onToggleExpand}
          className="mt-1 px-2 text-xs font-medium text-[var(--color-accent)] hover:underline"
        >
          {expanded ? "See less" : `See ${hidden} more`}
        </button>
      )}
    </div>
  );
}

function CheckRow({ item }: { item: FilterItem }) {
  return (
    <button
      onClick={item.onToggle}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--color-canvas)]"
    >
      <span
        className={`grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] text-white ${
          item.active
            ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
            : "border-[var(--color-line)] bg-[var(--color-surface)]"
        }`}
        aria-hidden
      >
        {item.active ? "✓" : ""}
      </span>
      <span className={item.active ? "" : "text-[var(--color-muted)]"}>
        {item.label}
      </span>
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
