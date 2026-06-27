import Link from "next/link";
import { ArrowRight } from "lucide-react";

const arc = [
  {
    step: "1",
    title: "Upload",
    body: "A district's contract (PDF) goes in. Text is pulled out in the browser — the file never leaves your machine.",
    href: "/upload",
    cta: "Upload a contract",
  },
  {
    step: "2",
    title: "Parse",
    body: "AI splits it into standardized sections — recognition, work year, bereavement leave, salary — and pulls out the key values.",
    href: "/upload",
    cta: null,
  },
  {
    step: "3",
    title: "Review",
    body: "Anything the AI was unsure about is flagged for a person to confirm or re-assign, right in the document. Nothing fails silently.",
    href: "/review",
    cta: "Review flagged sections",
  },
  {
    step: "4",
    title: "Compare",
    body: "Pick districts and sections, see them side by side with an at-a-glance range view and the source language one click away.",
    href: "/compare",
    cta: "Compare districts",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-[1080px] pt-6">
      <section className="max-w-[640px]">
        <span className="inline-block rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-[12px] font-semibold tracking-wide text-[var(--color-accent)]">
          Proof of concept · Contract comparison
        </span>
        <h1 className="font-display mt-5 text-[42px] font-semibold leading-[1.12] tracking-[-0.4px] text-[var(--color-ink-deep)]">
          Compare what every district negotiated — in seconds, not weeks.
        </h1>
        <p className="mt-4 max-w-[600px] text-[17px] leading-relaxed text-[#51607a]">
          A contract goes in, AI parses it into standardized sections, a person
          verifies, and you get instant, scannable comparison across districts —
          with the source language always one click away.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/compare"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(36,86,201,.28)] hover:opacity-95"
          >
            Start comparing <ArrowRight size={16} strokeWidth={2.2} />
          </Link>
          <Link
            href="/upload"
            className="inline-flex items-center rounded-lg border border-[#d8dee8] bg-[var(--color-surface)] px-5 py-2.5 text-sm font-semibold text-[var(--color-ink)] hover:bg-[#f8fafc]"
          >
            Add a contract
          </Link>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
          How it works
        </h2>
        {/* Hairline grid: the gap color shows through 1px gaps between cards. */}
        <div className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-[#e4e8ee]">
          <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4">
            {arc.map((a) => (
              <Link
                key={a.title}
                href={a.href}
                className="group flex flex-col bg-[var(--color-surface)] p-5 transition-colors hover:bg-[#f8fafc]"
              >
                <span className="grid h-7 w-7 place-items-center rounded-md bg-[var(--color-accent-soft)] text-[13px] font-semibold text-[var(--color-accent)]">
                  {a.step}
                </span>
                <h3 className="mt-3 text-[15px] font-semibold text-[var(--color-ink)]">
                  {a.title}
                </h3>
                <p className="mt-1.5 flex-1 text-[13.5px] leading-relaxed text-[var(--color-muted)]">
                  {a.body}
                </p>
                {a.cta && (
                  <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--color-accent)]">
                    {a.cta}
                    <ArrowRight
                      size={14}
                      strokeWidth={2.2}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
