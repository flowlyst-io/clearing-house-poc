"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Upload,
  CheckSquare,
  BarChart3,
  Landmark,
  Loader2,
  Check,
  AlertTriangle,
  X,
} from "lucide-react";
import { useDistricts } from "@/lib/store";
import { useParseJob, dismissJob, retry, PARSE_STEPS } from "@/lib/parseJob";
import type { District } from "@/lib/types";

// A district still "wants a human" if it isn't pooled yet, has a flagged section,
// or has uncategorized content. Mirrors the Review queue predicate.
function needsReview(d: District): boolean {
  return (
    !d.inPool ||
    d.sections.some((s) => s.status === "flagged") ||
    (d.unmatched?.length ?? 0) > 0
  );
}

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/review", label: "Review", icon: CheckSquare },
  { href: "/compare", label: "Compare", icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const districts = useDistricts();
  const job = useParseJob();
  const pooled = districts.filter((d) => d.inPool).length;
  const awaiting = districts.filter(needsReview).length;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[248px] flex-col bg-[#101b30] text-[#9fb0cd]">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <span
          className="grid h-[34px] w-[34px] place-items-center rounded-[9px] text-white"
          style={{ background: "linear-gradient(150deg,#3b6fe0,#2456c9)" }}
        >
          <Landmark size={18} strokeWidth={1.9} />
        </span>
        <span className="leading-tight">
          <span className="font-display block text-[16px] font-semibold text-white">
            Clearinghouse
          </span>
          <span className="block text-[11px] tracking-wide text-[#6f86ad]">
            flowlyst · BOCES
          </span>
        </span>
      </div>

      {/* Nav */}
      <nav className="mt-2 px-3">
        <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5b6f93]">
          Workspace
        </div>
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition-colors ${
                    active
                      ? "bg-[rgba(59,111,224,.18)] font-semibold text-white"
                      : "hover:bg-[rgba(255,255,255,.04)] hover:text-[#c8d4e8]"
                  }`}
                >
                  <Icon size={18} strokeWidth={1.9} />
                  <span>{item.label}</span>
                  {item.href === "/review" && awaiting > 0 && (
                    <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-[#d97706] px-1.5 text-[11px] font-semibold text-white">
                      {awaiting}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Parse progress pill — persists across navigation (state lives in the
          module store), so an in-flight parse is visible from any page. */}
      {job && (
        <div className="mt-auto px-4 pt-4">
          {job.phase === "parsing" && (
            <div className="rounded-xl border border-[rgba(59,111,224,.35)] bg-[rgba(59,111,224,.12)] p-3">
              <div className="flex items-center gap-2 text-[13px] font-medium text-white">
                <Loader2 size={15} className="animate-spin text-[#7aa2f0]" />
                <span className="truncate">Parsing {job.districtName}…</span>
              </div>
              <div className="mt-1 truncate pl-[23px] text-[11px] text-[#9fb0cd]">
                {PARSE_STEPS[job.step]}
              </div>
            </div>
          )}
          {job.phase === "done" && job.resultId && (
            <div className="flex items-start gap-2 rounded-xl border border-[rgba(52,168,110,.35)] bg-[rgba(52,168,110,.12)] p-3">
              <Check size={15} strokeWidth={2.5} className="mt-0.5 shrink-0 text-[#4ade80]" />
              <Link
                href={`/review?d=${job.resultId}`}
                onClick={() => dismissJob()}
                className="min-w-0 flex-1 text-[13px] font-medium text-white hover:underline"
              >
                <span className="block truncate">{job.districtName} ready</span>
                <span className="text-[11px] text-[#9fb0cd]">Review →</span>
              </Link>
              <button
                onClick={() => dismissJob()}
                aria-label="Dismiss"
                className="shrink-0 rounded p-0.5 text-[#6f86ad] hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
          )}
          {job.phase === "error" && (
            <div className="rounded-xl border border-[rgba(217,119,6,.4)] bg-[rgba(217,119,6,.14)] p-3">
              <div className="flex items-start gap-2 text-[12px] text-[#f0b24b]">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span className="min-w-0 flex-1">{job.error}</span>
                <button
                  onClick={() => dismissJob()}
                  aria-label="Dismiss"
                  className="shrink-0 rounded p-0.5 text-[#6f86ad] hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>
              {job.retryable && (
                <button
                  onClick={() => retry()}
                  className="mt-2 w-full rounded-md border border-[rgba(217,119,6,.5)] px-2 py-1 text-[12px] font-medium text-[#f0b24b] hover:bg-[rgba(217,119,6,.15)]"
                >
                  Retry
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Comparison pool card */}
      <div className={`${job ? "" : "mt-auto"} p-4`}>
        <div className="rounded-xl border border-[rgba(255,255,255,.07)] bg-[rgba(255,255,255,.04)] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5b6f93]">
            Comparison pool
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-display text-[28px] font-semibold leading-none text-white">
              {pooled}
            </span>
            <span className="text-[13px] text-[#9fb0cd]">districts</span>
          </div>
          {awaiting > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-[12px] text-[#f0b24b]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#d97706]" />
              {awaiting} awaiting review
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
