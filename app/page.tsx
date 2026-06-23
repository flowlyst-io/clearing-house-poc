import Link from "next/link";

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
    body: "AI splits it into the standardized sections — recognition, work year, bereavement leave, salary — and pulls out the key values.",
    href: "/upload",
    cta: null,
  },
  {
    step: "3",
    title: "Review",
    body: "Anything the AI was unsure about is flagged for a person to confirm or re-assign. Nothing fails silently.",
    href: "/review",
    cta: "Review flagged sections",
  },
  {
    step: "4",
    title: "Compare",
    body: "Pick districts and a section, see them side by side with an at-a-glance summary and the source language one click away.",
    href: "/compare",
    cta: "Compare districts",
  },
];

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          Compare what every district negotiated — in seconds, not weeks.
        </h1>
        <p className="mt-3 text-[var(--color-muted)]">
          A contract goes in, AI parses it into standardized sections, a person
          verifies, and you get instant, scannable comparison across districts
          with the source language always one click away.
        </p>
        <div className="mt-5 flex gap-3">
          <Link
            href="/compare"
            className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Start comparing
          </Link>
          <Link
            href="/upload"
            className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-canvas)]"
          >
            Add a contract
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {arc.map((a) => (
          <div
            key={a.title}
            className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5"
          >
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--color-accent-soft)] text-xs font-semibold text-[var(--color-accent)]">
                {a.step}
              </span>
              <h2 className="font-semibold">{a.title}</h2>
            </div>
            <p className="mt-2 text-sm text-[var(--color-muted)]">{a.body}</p>
            {a.cta && (
              <Link
                href={a.href}
                className="mt-3 inline-block text-sm font-medium text-[var(--color-accent)] hover:underline"
              >
                {a.cta} →
              </Link>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
