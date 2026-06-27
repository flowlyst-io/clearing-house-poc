"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useDistricts,
  getDistrict,
  updateDistrict,
  removeDistrict,
} from "@/lib/store";
import { TAXONOMY, sectionLabel } from "@/lib/taxonomy";
import type { District, ParsedSection, UnmatchedSection } from "@/lib/types";
import { buildSegments, type AnchorItem } from "@/lib/anchor";

export default function ReviewPage() {
  return (
    <Suspense fallback={null}>
      <ReviewInner />
    </Suspense>
  );
}

function ReviewInner() {
  const districts = useDistricts(); // list (no `pages`) — drives the tab strip
  const params = useSearchParams();
  const router = useRouter();

  const needsReview = useMemo(
    () =>
      districts.filter(
        (d) =>
          !d.inPool ||
          d.sections.some((s) => s.status === "flagged") ||
          (d.unmatched?.length ?? 0) > 0,
      ),
    [districts],
  );

  const focusId = params.get("d") ?? needsReview[0]?.id ?? null;

  // The focused district is fetched WITH its per-page text so the document
  // reader can render it (the list omits `pages`). Mutations replace it in place
  // via setFocused, using the full district the API returns.
  const [focused, setFocused] = useState<District | null>(null);
  const [docError, setDocError] = useState(false);

  useEffect(() => {
    if (!focusId) {
      setFocused(null);
      return;
    }
    let active = true;
    setFocused(null);
    setDocError(false);
    getDistrict(focusId)
      .then((d) => active && setFocused(d))
      .catch(() => active && setDocError(true));
    return () => {
      active = false;
    };
  }, [focusId]);

  if (!focusId) {
    // The DB always holds the seed districts, so a loaded-but-empty queue means
    // everything is confirmed; an empty list means we're still loading.
    if (districts.length > 0 && needsReview.length === 0) {
      return (
        <div className="space-y-4">
          <h1 className="text-xl font-semibold">Review</h1>
          <p className="text-sm text-[var(--color-muted)]">
            Nothing waiting for review. Every district in the pool has been
            confirmed.
          </p>
          <Link
            href="/upload"
            className="inline-block rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Add a contract →
          </Link>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="space-y-6">
      {needsReview.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {needsReview.map((d) => (
            <Link
              key={d.id}
              href={`/review?d=${d.id}`}
              className={`rounded-md border px-3 py-1 text-sm ${
                d.id === focusId
                  ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-white"
                  : "border-[var(--color-line)] bg-[var(--color-surface)]"
              }`}
            >
              {d.name}
            </Link>
          ))}
        </div>
      )}
      {focused ? (
        <DistrictReview
          key={focused.id}
          district={focused}
          router={router}
          onChange={setFocused}
        />
      ) : (
        <p className="text-sm text-[var(--color-muted)]">
          {docError ? "Couldn't load this contract." : "Loading…"}
        </p>
      )}
    </div>
  );
}

// ---- one reviewable thing (a parsed section OR an uncategorized snippet) ----
type Item =
  | {
      id: string;
      kind: "section";
      index: number;
      section: ParsedSection;
      query: string;
      endQuery?: string;
    }
  | {
      id: string;
      kind: "unmatched";
      index: number;
      unmatched: UnmatchedSection;
      query: string;
      endQuery?: string;
    };

function toneOf(it: Item) {
  if (it.kind === "unmatched")
    return {
      mark: "bg-[#ede9fe] text-[#5b21b6]",
      ring: "ring-[#7c3aed]",
      dot: "bg-[#7c3aed]",
      label: "uncategorized",
    };
  return it.section.status === "confirmed"
    ? {
        mark: "bg-[var(--color-ok-soft)] text-[var(--color-ok)]",
        ring: "ring-[var(--color-ok)]",
        dot: "bg-[var(--color-ok)]",
        label: "confirmed",
      }
    : {
        mark: "bg-[var(--color-flag-soft)] text-[var(--color-flag)]",
        ring: "ring-[var(--color-flag)]",
        dot: "bg-[var(--color-flag)]",
        label: "needs review",
      };
}

function DistrictReview({
  district,
  router,
  onChange,
}: {
  district: District;
  router: ReturnType<typeof useRouter>;
  onChange: (d: District) => void;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const items: Item[] = [
    ...district.sections.map((section, index) => ({
      id: `s:${index}`,
      kind: "section" as const,
      index,
      section,
      query: section.anchor || section.sourceText.slice(0, 80),
      endQuery: section.anchorEnd,
    })),
    ...(district.unmatched ?? []).map((unmatched, index) => ({
      id: `u:${index}`,
      kind: "unmatched" as const,
      index,
      unmatched,
      query: unmatched.anchor || unmatched.sourceText.slice(0, 80),
      endQuery: unmatched.anchorEnd,
    })),
  ];
  const byId = new Map(items.map((it) => [it.id, it]));

  const pages = district.pages ?? [];
  const hasDoc = pages.length > 0;
  const anchorItems: AnchorItem[] = items.map((it) => ({
    id: it.id,
    query: it.query,
    endQuery: it.endQuery,
  }));
  const perPage = pages.map((p) => buildSegments(p, anchorItems));
  const placed = new Set<string>();
  perPage.forEach((pp) => pp.placed.forEach((id) => placed.add(id)));

  const flagged = items.filter(
    (it) => it.kind === "section" && it.section.status === "flagged",
  );
  const confirmed = items.filter(
    (it) => it.kind === "section" && it.section.status === "confirmed",
  );
  const uncategorized = items.filter((it) => it.kind === "unmatched");
  const totalSections = district.sections.length;

  // ---- mutations: each is a persisted PATCH; surface failures, refresh in place ----
  async function save(patch: Partial<District>): Promise<boolean> {
    try {
      setSaveError(null);
      const updated = await updateDistrict(district.id, patch);
      onChange(updated); // server returns the full district (incl. pages)
      return true;
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save your change.");
      return false;
    }
  }

  function patchSection(index: number, patch: Partial<ParsedSection>) {
    void save({
      sections: district.sections.map((s, i) =>
        i === index ? { ...s, ...patch } : s,
      ),
    });
  }
  function assignUnmatched(u: UnmatchedSection, taxonomyKey: string) {
    const newSection: ParsedSection = {
      taxonomyKey,
      extractedValue: "",
      sourceText: u.sourceText,
      anchor: u.anchor,
      anchorEnd: u.anchorEnd,
      confidence: 1,
      status: "flagged",
      note: "Assigned from uncategorized — set the value, then confirm.",
    };
    void save({
      sections: [...district.sections, newSection],
      unmatched: (district.unmatched ?? []).filter((x) => x !== u),
    }).then((ok) => ok && setActive(null));
  }
  function dismissUnmatched(u: UnmatchedSection) {
    void save({
      unmatched: (district.unmatched ?? []).filter((x) => x !== u),
    }).then((ok) => ok && setActive(null));
  }
  async function addToPool() {
    // Pages stay in Postgres (the list query excludes them, so Compare's load
    // isn't affected); no need to shed text the way the localStorage store did.
    if (await save({ inPool: true })) router.push("/compare");
  }
  async function discard() {
    if (confirm(`Remove ${district.name} from the workspace?`)) {
      try {
        await removeDistrict(district.id);
        router.push("/review");
      } catch (e) {
        setSaveError(
          e instanceof Error ? e.message : "Couldn't remove the district.",
        );
      }
    }
  }

  function focus(id: string) {
    setActive(id);
    if (hasDoc && placed.has(id)) {
      // Scroll the real scroll container (#main-scroll), not the window — compute
      // the mark's offset relative to the container and center it.
      requestAnimationFrame(() => {
        const el = document.getElementById(`hl-${id}`);
        const container = document.getElementById("main-scroll");
        if (!el || !container) return;
        const elRect = el.getBoundingClientRect();
        const cRect = container.getBoundingClientRect();
        const delta =
          elRect.top - cRect.top - cRect.height / 2 + elRect.height / 2;
        container.scrollTo({
          top: container.scrollTop + delta,
          behavior: "smooth",
        });
      });
    }
  }

  function renderControls(it: Item) {
    if (it.kind === "section") {
      const s = it.section;
      return (
        <div className="space-y-2">
          <select
            value={s.taxonomyKey}
            onChange={(e) => patchSection(it.index, { taxonomyKey: e.target.value })}
            className="w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-1.5 text-sm"
          >
            {TAXONOMY.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
          <textarea
            value={s.extractedValue}
            onChange={(e) => patchSection(it.index, { extractedValue: e.target.value })}
            placeholder="Value (e.g. 5 days)"
            rows={2}
            // Wraps long values (a full salary schedule) instead of clipping them
            // to one line; field-sizing grows it to fit, capped so the popover
            // can't run off-screen (scrolls past the cap).
            className="w-full resize-y rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-1.5 text-sm leading-snug [field-sizing:content] min-h-[2.25rem] max-h-40 overflow-y-auto"
          />
          <div className="flex gap-2">
            {s.status === "flagged" ? (
              <button
                disabled={!s.extractedValue.trim()}
                onClick={() => patchSection(it.index, { status: "confirmed", note: undefined })}
                className="rounded-md bg-[var(--color-ok)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
              >
                Confirm
              </button>
            ) : (
              <button
                onClick={() => patchSection(it.index, { status: "flagged", note: "Re-opened." })}
                className="rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs"
              >
                Re-open
              </button>
            )}
            <button
              onClick={() => setActive(null)}
              className="rounded-md px-2 py-1.5 text-xs text-[var(--color-muted)] hover:bg-[var(--color-canvas)]"
            >
              Close
            </button>
          </div>
        </div>
      );
    }
    const u = it.unmatched;
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium">{u.label}</div>
        <select
          defaultValue=""
          onChange={(e) => e.target.value && assignUnmatched(u, e.target.value)}
          className="w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-1.5 text-sm"
        >
          <option value="">Assign to section…</option>
          {TAXONOMY.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            onClick={() => dismissUnmatched(u)}
            className="rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs text-[var(--color-muted)]"
          >
            Dismiss
          </button>
          <button
            onClick={() => setActive(null)}
            className="rounded-md px-2 py-1.5 text-xs text-[var(--color-muted)] hover:bg-[var(--color-canvas)]"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-[26px] font-semibold tracking-[-0.3px] text-[var(--color-ink-deep)]">
              {district.name}
            </h1>
            {district.source === "parsed" && (
              <span className="rounded-full bg-[var(--color-accent-soft)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
                Parsed live
              </span>
            )}
          </div>
          <p className="mt-1 text-[13.5px] text-[var(--color-muted)]">
            {district.term ? `${district.term} · ` : ""}
            {confirmed.length}/{totalSections} sections confirmed ·{" "}
            {flagged.length} need review · {uncategorized.length} uncategorized
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={discard}
            className="rounded-lg border border-[#d8dee8] px-3.5 py-2 text-sm text-[var(--color-muted)] hover:bg-[var(--color-canvas)]"
          >
            Discard
          </button>
          <button
            onClick={addToPool}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(36,86,201,.28)] hover:opacity-95"
          >
            {district.inPool ? "Done — back to Compare" : "Add to comparison pool"}
            {flagged.length > 0 && !district.inPool ? ` (${flagged.length} flagged)` : ""}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="rounded-md bg-[var(--color-flag-soft)] px-3 py-2 text-sm text-[var(--color-flag)]">
          {saveError}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-[var(--color-muted)]">
        <Legend dot="bg-[var(--color-ok)]" label="Confirmed" />
        <Legend dot="bg-[var(--color-flag)]" label="Needs review" />
        <Legend dot="bg-[#7c3aed]" label="Uncategorized" />
        <span>Click any highlight (or an item on the right) to review it.</span>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Document reader */}
        {hasDoc ? (
          <div className="min-w-0 flex-1 space-y-4">
            {pages.map((pageText, pi) => (
              <div
                key={pi}
                className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5"
              >
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                  Page {pi + 1}
                </div>
                <div className="font-display whitespace-pre-wrap text-[15px] leading-[1.78] text-[#334155]">
                  {perPage[pi].segments.map((seg, si) => {
                    if (!seg.itemId) return <PlainText key={si} text={seg.text} />;
                    const it = byId.get(seg.itemId);
                    if (!it) return <span key={si}>{seg.text}</span>;
                    const tone = toneOf(it);
                    const isActive = active === it.id;
                    return (
                      <span key={si} className="relative">
                        <mark
                          id={`hl-${it.id}`}
                          onClick={() => setActive(isActive ? null : it.id)}
                          className={`cursor-pointer rounded-[4px] px-[3px] py-[1px] ${tone.mark} ${
                            isActive ? `ring-2 ${tone.ring}` : ""
                          }`}
                          title="Review this"
                        >
                          {seg.text}
                        </mark>
                        {isActive && (
                          <span className="absolute left-0 top-full z-30 mt-1 block w-[290px] rounded-[11px] border border-[var(--color-line)] bg-[var(--color-surface)] p-3 text-[var(--color-ink)] shadow-[0_14px_38px_rgba(16,27,48,.2)]">
                            {renderControls(it)}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="min-w-0 flex-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-muted)]">
            No document text is stored for this contract (it was added before the
            reader, or is seed data). Review the items on the right; re-upload the
            PDF to see the full document view.
          </div>
        )}

        {/* Click-away layer for an open in-document popover */}
        {active && hasDoc && placed.has(active) && (
          <div className="fixed inset-0 z-20" onClick={() => setActive(null)} aria-hidden />
        )}

        {/* Synced index */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-5rem)] lg:w-80 lg:shrink-0 lg:self-start lg:overflow-y-auto">
          <IndexGroup
            title="Needs review"
            items={flagged}
            active={active}
            placed={placed}
            hasDoc={hasDoc}
            onFocus={focus}
            renderControls={renderControls}
          />
          <IndexGroup
            title="Uncategorized"
            items={uncategorized}
            active={active}
            placed={placed}
            hasDoc={hasDoc}
            onFocus={focus}
            renderControls={renderControls}
          />
          <IndexGroup
            title="Confirmed"
            items={confirmed}
            active={active}
            placed={placed}
            hasDoc={hasDoc}
            onFocus={focus}
            renderControls={renderControls}
          />
        </aside>
      </div>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

// A line is treated as a heading if it's an "ARTICLE …" line or a short ALL-CAPS
// line (the section headers in these contracts). Used to bold headings in the
// document reader. Line breaks themselves render via the container's pre-wrap.
function isHeadingLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 2 || t.length > 60) return false;
  if (/^ARTICLE\b/i.test(t)) return true;
  return /[A-Z]/.test(t) && !/[a-z]/.test(t);
}

function PlainText({ text }: { text: string }) {
  // Keep the newlines as tokens so pre-wrap still produces the line breaks;
  // wrap heading lines in bold.
  const parts = text.split(/(\n)/);
  return (
    <>
      {parts.map((part, i) => {
        if (part === "\n") return "\n";
        if (part === "") return null;
        if (isHeadingLine(part))
          return (
            <span key={i} className="font-semibold text-[var(--color-ink)]">
              {part}
            </span>
          );
        return part;
      })}
    </>
  );
}

function IndexGroup({
  title,
  items,
  active,
  placed,
  hasDoc,
  onFocus,
  renderControls,
}: {
  title: string;
  items: Item[];
  active: string | null;
  placed: Set<string>;
  hasDoc: boolean;
  onFocus: (id: string) => void;
  renderControls: (it: Item) => React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
          {title}
        </h2>
        <span className="rounded-full bg-[var(--color-canvas)] px-1.5 text-xs text-[var(--color-muted)]">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="px-2 text-xs text-[var(--color-muted)]">None.</p>
      ) : (
        <div className="space-y-1">
          {items.map((it) => {
            const tone = toneOf(it);
            const label =
              it.kind === "section"
                ? sectionLabel(it.section.taxonomyKey)
                : it.unmatched.label;
            const sub =
              it.kind === "section"
                ? it.section.extractedValue || "no value set"
                : it.unmatched.sourceText.slice(0, 60) + "…";
            const isActive = active === it.id;
            const notLocated = hasDoc && !placed.has(it.id);
            const inlineControls = isActive && (!hasDoc || !placed.has(it.id));
            return (
              <div
                key={it.id}
                className={`rounded-md border ${
                  isActive
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                    : "border-[var(--color-line)] bg-[var(--color-surface)]"
                }`}
              >
                <button
                  onClick={() => onFocus(it.id)}
                  className="w-full px-2.5 py-2 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
                    <span className="text-sm font-medium">{label}</span>
                    {notLocated && (
                      <span className="ml-auto rounded bg-[var(--color-canvas)] px-1 text-[10px] text-[var(--color-muted)]">
                        not located
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-[var(--color-muted)]">
                    {sub}
                  </div>
                </button>
                {inlineControls && (
                  <div className="border-t border-[var(--color-line)] p-2.5">
                    {renderControls(it)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
