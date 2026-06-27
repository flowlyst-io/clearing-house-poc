"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search, Star, X, ArrowRight } from "lucide-react";
import { useDistricts } from "@/lib/store";
import {
  TAXONOMY,
  TAXONOMY_BY_KEY,
  TAXONOMY_GROUPS,
} from "@/lib/taxonomy";
import type { TaxonomySection } from "@/lib/taxonomy";
import type { District, ParsedSection } from "@/lib/types";
import { districtColor } from "@/lib/colors";
import {
  parseNumeric,
  formatValue,
  median,
  highlightNumbers,
} from "@/lib/values";

const DEFAULT_SECTIONS = ["salary_schedule", "health_insurance", "sick_leave"];

interface SummaryState {
  loading: boolean;
  text: string;
  error: string | null;
}

export default function ComparePage() {
  const districts = useDistricts();
  const pool = useMemo(() => districts.filter((d) => d.inPool), [districts]);

  // District viz color is assigned in pool order — same color everywhere.
  const colorById = useMemo(() => {
    const m = new Map<string, string>();
    pool.forEach((d, i) => m.set(d.id, districtColor(i)));
    return m;
  }, [pool]);

  const [sectionKeys, setSectionKeys] = useState<Set<string>>(
    new Set(DEFAULT_SECTIONS),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState<{
    district: District;
    section: ParsedSection;
  } | null>(null);

  // Auto-select arriving districts, preserve deliberate deselections.
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
  const sections = TAXONOMY.filter((s) => sectionKeys.has(s.key));

  // Search narrows only which OPTIONS show — never the selection or the matrix.
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
  function selectAll(prev: Set<string>, ids: string[]): Set<string> {
    const next = new Set(prev);
    ids.forEach((id) => next.add(id));
    return next;
  }

  const selectedIdsKey = [...selected].sort().join(",");
  const sectionKeysKey = [...sectionKeys].sort().join(",");

  function rowFor(d: District, key: string): ParsedSection | null {
    return d.sections.find((s) => s.taxonomyKey === key) ?? null;
  }

  // ---- One overall AI synthesis across everything selected ----
  const [overall, setOverall] = useState<SummaryState>({
    loading: false,
    text: "",
    error: null,
  });
  const fetchedKey = useRef<string | null>(null);

  function fetchOverall(force = false) {
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
        fetchedKey.current = null;
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

  const sectionsByGroup = TAXONOMY_GROUPS.map((g) => ({
    group: g,
    items: visibleSections.filter((s) => s.group === g),
  })).filter((x) => x.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-semibold tracking-[-0.3px] text-[var(--color-ink-deep)]">
            Compare districts
          </h1>
          <p className="mt-1 max-w-[620px] text-[13.5px] leading-relaxed text-[var(--color-muted)]">
            Pick sections and districts. Dots on each range show where every
            district falls; click any value for the source language.
          </p>
        </div>
        {pool.length === 0 && (
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(36,86,201,.28)]"
          >
            Add a contract <ArrowRight size={16} strokeWidth={2.2} />
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Filter rail */}
        <aside className="space-y-5 lg:sticky lg:top-4 lg:max-h-[calc(100vh-3rem)] lg:w-[248px] lg:shrink-0 lg:self-start lg:overflow-y-auto">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sections or districts…"
              className="w-full rounded-lg border border-[#dde3ec] bg-[var(--color-surface)] py-2 pl-9 pr-7 text-sm outline-none focus:border-[var(--color-accent)]"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sections — grouped */}
          <div>
            <RailHeader
              label="Sections"
              count={`${sections.length}/${TAXONOMY.length}`}
              onAll={() =>
                setSectionKeys((prev) =>
                  selectAll(prev, visibleSections.map((s) => s.key)),
                )
              }
              onClear={() => setSectionKeys(new Set())}
            />
            {sectionsByGroup.length === 0 ? (
              <p className="px-2 py-1 text-xs text-[var(--color-muted)]">No matches.</p>
            ) : (
              <div className="mt-2 space-y-3">
                {sectionsByGroup.map(({ group, items }) => (
                  <div key={group}>
                    <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#94a3b8]">
                      {group}
                    </div>
                    <div className="space-y-0.5">
                      {items.map((s) => (
                        <CheckRow
                          key={s.key}
                          label={s.label}
                          active={sectionKeys.has(s.key)}
                          onToggle={() =>
                            setSectionKeys((prev) => toggle(prev, s.key))
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Districts — with viz color dots */}
          {pool.length > 0 && (
            <div>
              <RailHeader
                label="Districts"
                count={`${chosen.length}/${pool.length}`}
                onAll={() =>
                  setSelected((prev) =>
                    selectAll(prev, visibleDistricts.map((d) => d.id)),
                  )
                }
                onClear={() => setSelected(new Set())}
              />
              <div className="mt-2 space-y-0.5">
                {visibleDistricts.length === 0 ? (
                  <p className="px-2 py-1 text-xs text-[var(--color-muted)]">
                    No matches.
                  </p>
                ) : (
                  visibleDistricts.map((d) => (
                    <CheckRow
                      key={d.id}
                      label={d.name}
                      active={selected.has(d.id)}
                      dot={colorById.get(d.id)}
                      onToggle={() => setSelected((prev) => toggle(prev, d.id))}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </aside>

        {/* Matrix */}
        <div className="min-w-0 flex-1 space-y-4">
          {sections.length > 0 && chosen.length > 0 && (
            <div
              className="rounded-[14px] border border-[#dbe6fb] p-4"
              style={{ background: "linear-gradient(180deg,#f5f8ff,#fbfcff)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]">
                  <Star size={13} className="fill-[var(--color-accent)]" /> AI synthesis
                </span>
                <span className="text-[12px] text-[var(--color-muted)]">
                  {chosen.length} district{chosen.length === 1 ? "" : "s"} ·{" "}
                  {sections.length} section{sections.length === 1 ? "" : "s"}
                  {overall.error && (
                    <button
                      onClick={() => fetchOverall(true)}
                      className="ml-2 font-medium text-[var(--color-accent)] underline"
                    >
                      Retry
                    </button>
                  )}
                </span>
              </div>
              <p className="font-display mt-2 text-[15px] leading-[1.6] text-[#1f2b40]">
                {overall.loading ? (
                  <span className="text-[var(--color-muted)]">
                    Reading the values across the selection…
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
            <p className="rounded-[14px] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-muted)]">
              {sections.length === 0
                ? "Select at least one section on the left."
                : "Select at least one district on the left."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-[14px] border border-[var(--color-line)] bg-[var(--color-surface)]">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-line)]">
                    <th className="sticky left-0 top-0 z-20 bg-[var(--color-surface)] px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">
                      Section
                    </th>
                    {chosen.map((d) => (
                      <th
                        key={d.id}
                        className="sticky top-0 z-10 min-w-44 bg-[var(--color-surface)] px-4 py-3 text-left align-bottom"
                      >
                        <span className="flex items-center gap-1.5">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: colorById.get(d.id) }}
                          />
                          <span className="font-semibold text-[var(--color-ink)]">
                            {d.name}
                          </span>
                        </span>
                        {d.term && (
                          <div className="mt-0.5 pl-4 text-xs font-normal text-[var(--color-muted)]">
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
                      colorById={colorById}
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

function RangeBar({
  section,
  cells,
  colorById,
}: {
  section: TaxonomySection;
  cells: { d: District; sec: ParsedSection | null }[];
  colorById: Map<string, string>;
}) {
  const points = cells
    .filter((c) => c.sec)
    .map((c) => ({
      id: c.d.id,
      n: parseNumeric(section.valueKind, c.sec!.extractedValue),
    }))
    .filter((p): p is { id: string; n: number } => p.n !== null);
  if (points.length < 2) return null;

  const nums = points.map((p) => p.n);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const med = median(nums);
  const span = max - min || 1;
  const pos = (n: number) => ((n - min) / span) * 100;

  return (
    <div className="mt-2 max-w-[260px]">
      <div className="relative mx-[6px] h-[3px] rounded-full bg-[var(--color-line)]">
        <span
          className="absolute top-1/2 h-[10px] w-[2px] -translate-x-1/2 -translate-y-1/2 bg-[#aab4c4]"
          style={{ left: `${pos(med)}%` }}
        />
        {points.map((p) => (
          <span
            key={p.id}
            className="absolute top-1/2 h-[11px] w-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
            style={{ left: `${pos(p.n)}%`, background: colorById.get(p.id) }}
          />
        ))}
      </div>
      <div className="mt-1.5 text-[12px] text-[var(--color-muted)]">
        {formatValue(section.valueKind, min)}–{formatValue(section.valueKind, max)}{" "}
        · median {formatValue(section.valueKind, med)}
      </div>
    </div>
  );
}

function SectionRow({
  section,
  districts,
  rowFor,
  colorById,
  onOpen,
}: {
  section: TaxonomySection;
  districts: District[];
  rowFor: (d: District, key: string) => ParsedSection | null;
  colorById: Map<string, string>;
  onOpen: (d: District, s: ParsedSection) => void;
}) {
  const cells = districts.map((d) => ({ d, sec: rowFor(d, section.key) }));

  return (
    <tr className="border-t border-[#eef1f6] align-top">
      <th className="sticky left-0 z-10 bg-[var(--color-surface)] px-4 py-3 text-left align-top">
        <div className="font-semibold text-[var(--color-ink)]">{section.label}</div>
        <RangeBar section={section} cells={cells} colorById={colorById} />
      </th>
      {cells.map(({ d, sec }) => (
        <td key={d.id} className="px-4 py-3">
          {sec ? (
            <button
              onClick={() => onOpen(d, sec)}
              className="text-left hover:underline"
              title="View source language"
            >
              <span className="font-medium text-[var(--color-ink)]">
                {highlightNumbers(sec.extractedValue).map((p, i) =>
                  p.isNumber ? (
                    <span
                      key={i}
                      className="rounded bg-[var(--color-accent-soft)] px-1 font-semibold tabular-nums text-[var(--color-accent)]"
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

function RailHeader({
  label,
  count,
  onAll,
  onClear,
}: {
  label: string;
  count: string;
  onAll: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-muted)]">
        {label} · {count}
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
  );
}

function CheckRow({
  label,
  active,
  dot,
  onToggle,
}: {
  label: string;
  active: boolean;
  dot?: string;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--color-canvas)]"
    >
      <span
        className={`grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border text-[10px] text-white ${
          active
            ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
            : "border-[#cdd5e2] bg-[var(--color-surface)]"
        }`}
        aria-hidden
      >
        {active ? "✓" : ""}
      </span>
      {dot && (
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: dot }}
        />
      )}
      <span className={active ? "text-[var(--color-ink)]" : "text-[var(--color-muted)]"}>
        {label}
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
      <div
        className="absolute inset-0 bg-[rgba(16,27,48,.34)]"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative h-full w-full max-w-[440px] overflow-y-auto bg-[var(--color-surface)] p-7 shadow-[-12px_0_40px_rgba(16,27,48,.18)]">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-muted)]">
              {districtName}
            </div>
            <h3 className="font-display mt-1 text-[22px] font-semibold text-[var(--color-ink-deep)]">
              {sectionLabel}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--color-line)] text-[var(--color-muted)] hover:bg-[var(--color-canvas)]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-muted)]">
            Extracted value
          </div>
          <div className="mt-1 text-[19px] font-bold text-[var(--color-ink-deep)]">
            {section.extractedValue || "—"}
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-muted)]">
            Source language
            {typeof section.page === "number" && <span>· p.{section.page}</span>}
          </div>
          <p className="font-display mt-2 rounded-r-md border-l-2 border-[#c9d6ee] bg-[#f7f9fc] px-4 py-3 text-[15.5px] leading-[1.7] text-[#334155]">
            {section.sourceText || "No source text captured."}
          </p>
        </div>

        <div className="mt-6 flex items-center gap-2 text-[13px]">
          <span className="flex items-center gap-1 font-medium text-[var(--color-ok)]">
            ✓ Human-verified
          </span>
          <span className="text-[var(--color-muted)]">
            · {Math.round(section.confidence * 100)}% model confidence
          </span>
        </div>
      </div>
    </div>
  );
}
