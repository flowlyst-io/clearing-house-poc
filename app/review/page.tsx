"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useDistricts, updateDistrict, removeDistrict } from "@/lib/store";
import { TAXONOMY, sectionLabel } from "@/lib/taxonomy";
import type { District, ParsedSection, UnmatchedSection } from "@/lib/types";

export default function ReviewPage() {
  return (
    <Suspense fallback={null}>
      <ReviewInner />
    </Suspense>
  );
}

function ReviewInner() {
  const districts = useDistricts();
  const params = useSearchParams();
  const router = useRouter();

  // Districts that still want a human: not yet pooled, or have flagged/unmatched.
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

  const focusId = params.get("d");
  const district =
    districts.find((d) => d.id === focusId) ?? needsReview[0] ?? null;

  if (!district) {
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

  return (
    <div className="space-y-6">
      {needsReview.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {needsReview.map((d) => (
            <Link
              key={d.id}
              href={`/review?d=${d.id}`}
              className={`rounded-md border px-3 py-1 text-sm ${
                d.id === district.id
                  ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-white"
                  : "border-[var(--color-line)] bg-[var(--color-surface)]"
              }`}
            >
              {d.name}
            </Link>
          ))}
        </div>
      )}
      <DistrictReview key={district.id} district={district} router={router} />
    </div>
  );
}

function DistrictReview({
  district,
  router,
}: {
  district: District;
  router: ReturnType<typeof useRouter>;
}) {
  const [saveError, setSaveError] = useState<string | null>(null);

  const flagged = district.sections
    .map((s, i) => ({ s, i }))
    .filter((x) => x.s.status === "flagged");
  const confirmed = district.sections
    .map((s, i) => ({ s, i }))
    .filter((x) => x.s.status === "confirmed");
  const unmatched = district.unmatched ?? [];

  // Every edit is a persisted PATCH; surface a failure instead of losing it silently.
  async function save(patch: Partial<District>) {
    try {
      setSaveError(null);
      await updateDistrict(district.id, patch);
      return true;
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save your change.");
      return false;
    }
  }

  function patchSection(index: number, patch: Partial<ParsedSection>) {
    const sections = district.sections.map((s, i) =>
      i === index ? { ...s, ...patch } : s,
    );
    void save({ sections });
  }

  function assignUnmatched(u: UnmatchedSection, taxonomyKey: string) {
    const newSection: ParsedSection = {
      taxonomyKey,
      extractedValue: "",
      sourceText: u.sourceText,
      confidence: 1,
      status: "flagged",
      note: "Assigned from uncategorized — set the value, then confirm.",
    };
    void save({
      sections: [...district.sections, newSection],
      unmatched: (district.unmatched ?? []).filter((x) => x !== u),
    });
  }

  function dismissUnmatched(u: UnmatchedSection) {
    void save({
      unmatched: (district.unmatched ?? []).filter((x) => x !== u),
    });
  }

  async function addToPool() {
    if (await save({ inPool: true })) router.push("/compare");
  }

  async function discard() {
    if (confirm(`Remove ${district.name} from the workspace?`)) {
      try {
        await removeDistrict(district.id);
        router.push("/review");
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Couldn't remove the district.");
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{district.name}</h1>
          <p className="text-sm text-[var(--color-muted)]">
            {district.term ? `${district.term} · ` : ""}
            {district.inPool ? "In comparison pool" : "Not yet in pool"} ·{" "}
            {flagged.length} need review · {unmatched.length} uncategorized
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={discard}
            className="rounded-md border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-muted)] hover:bg-[var(--color-canvas)]"
          >
            Discard
          </button>
          <button
            onClick={addToPool}
            className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white"
          >
            {district.inPool ? "Done" : "Add to comparison pool"}
            {flagged.length > 0 && !district.inPool
              ? ` (${flagged.length} still flagged)`
              : ""}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="rounded-md bg-[var(--color-flag-soft)] px-3 py-2 text-sm text-[var(--color-flag)]">
          {saveError}
        </div>
      )}

      {/* Needs review */}
      <section>
        <SectionHeading
          tone="flag"
          title="Needs review"
          count={flagged.length}
          blurb="The AI was unsure, or you just assigned these. Set the value, fix the section if it's mislabeled, then confirm."
        />
        {flagged.length === 0 ? (
          <Empty>Nothing flagged. </Empty>
        ) : (
          <div className="space-y-3">
            {flagged.map(({ s, i }) => (
              <FlaggedCard
                key={i}
                section={s}
                onChange={(patch) => patchSection(i, patch)}
                onConfirm={() =>
                  patchSection(i, { status: "confirmed", note: undefined })
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Uncategorized */}
      {unmatched.length > 0 && (
        <section>
          <SectionHeading
            tone="flag"
            title="Uncategorized"
            count={unmatched.length}
            blurb="Content the AI found but couldn't place in the standard sections. Assign it to a section, or dismiss it."
          />
          <div className="space-y-3">
            {unmatched.map((u, idx) => (
              <UnmatchedCard
                key={idx}
                u={u}
                onAssign={(key) => assignUnmatched(u, key)}
                onDismiss={() => dismissUnmatched(u)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Confirmed */}
      <section>
        <SectionHeading
          tone="ok"
          title="Confirmed"
          count={confirmed.length}
          blurb="These will show in Compare."
        />
        <div className="divide-y divide-[var(--color-line)] rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
          {confirmed.map(({ s, i }) => (
            <ConfirmedRow
              key={i}
              section={s}
              onReassign={(key) => patchSection(i, { taxonomyKey: key })}
              onUnconfirm={() =>
                patchSection(i, { status: "flagged", note: "Re-opened." })
              }
            />
          ))}
          {confirmed.length === 0 && <Empty>None yet.</Empty>}
        </div>
      </section>
    </div>
  );
}

function SectionHeading({
  title,
  count,
  blurb,
  tone,
}: {
  title: string;
  count: number;
  blurb: string;
  tone: "flag" | "ok";
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">{title}</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            tone === "flag"
              ? "bg-[var(--color-flag-soft)] text-[var(--color-flag)]"
              : "bg-[var(--color-ok-soft)] text-[var(--color-ok)]"
          }`}
        >
          {count}
        </span>
      </div>
      <p className="text-sm text-[var(--color-muted)]">{blurb}</p>
    </div>
  );
}

function TaxonomySelect({
  value,
  onChange,
  placeholder,
}: {
  value?: string;
  onChange: (key: string) => void;
  placeholder?: string;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {TAXONOMY.map((t) => (
        <option key={t.key} value={t.key}>
          {t.label}
        </option>
      ))}
    </select>
  );
}

function FlaggedCard({
  section,
  onChange,
  onConfirm,
}: {
  section: ParsedSection;
  onChange: (patch: Partial<ParsedSection>) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-flag)]/40 bg-[var(--color-flag-soft)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <TaxonomySelect
          value={section.taxonomyKey}
          onChange={(key) => onChange({ taxonomyKey: key })}
        />
        <span className="text-xs text-[var(--color-muted)]">
          confidence {Math.round(section.confidence * 100)}%
        </span>
      </div>
      {section.note && (
        <p className="mt-2 text-xs text-[var(--color-flag)]">{section.note}</p>
      )}
      <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
        Value
      </label>
      <input
        value={section.extractedValue}
        onChange={(e) => onChange({ extractedValue: e.target.value })}
        placeholder="e.g. 5 days (immediate family)"
        className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
      />
      {section.sourceText && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-[var(--color-accent)]">
            Source language
          </summary>
          <p className="mt-1 whitespace-pre-wrap rounded-md bg-[var(--color-surface)] p-3 text-sm leading-relaxed">
            {section.sourceText}
          </p>
        </details>
      )}
      <div className="mt-3">
        <button
          onClick={onConfirm}
          disabled={!section.extractedValue.trim()}
          className="rounded-md bg-[var(--color-ok)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

function UnmatchedCard({
  u,
  onAssign,
  onDismiss,
}: {
  u: UnmatchedSection;
  onAssign: (key: string) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <div className="font-medium">{u.label}</div>
      <p className="mt-1 whitespace-pre-wrap rounded-md bg-[var(--color-canvas)] p-3 text-sm leading-relaxed">
        {u.sourceText}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <TaxonomySelect placeholder="Assign to section…" onChange={onAssign} />
        <button
          onClick={onDismiss}
          className="text-sm text-[var(--color-muted)] hover:underline"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function ConfirmedRow({
  section,
  onReassign,
  onUnconfirm,
}: {
  section: ParsedSection;
  onReassign: (key: string) => void;
  onUnconfirm: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-3">
      <span className="min-w-40 text-sm font-medium">
        {sectionLabel(section.taxonomyKey)}
      </span>
      <span className="flex-1 text-sm text-[var(--color-muted)]">
        {section.extractedValue}
      </span>
      <TaxonomySelect
        value={section.taxonomyKey}
        onChange={onReassign}
      />
      <button
        onClick={onUnconfirm}
        className="text-sm text-[var(--color-muted)] hover:underline"
      >
        Re-open
      </button>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="p-3 text-sm text-[var(--color-muted)]">{children}</p>;
}
