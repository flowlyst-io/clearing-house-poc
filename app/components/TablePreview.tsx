"use client";

import { useState } from "react";
import { ChevronDown, Table2 } from "lucide-react";
import type { Table } from "@/lib/tables";

// Shows tables reconstructed from the PDF's text-layer coordinates (see
// lib/tables.ts). This is a layout-only reconstruction — no OCR — so it's a
// preview of what the extractor recovered, not an edit surface. `tables` is
// parallel to the extracted pages.
export default function TablePreview({ tables }: { tables: Table[][] }) {
  const [open, setOpen] = useState(true);
  const flat = tables.flatMap((pageTables, pi) =>
    pageTables.map((t, ti) => ({ page: pi + 1, key: `${pi}-${ti}`, table: t })),
  );
  if (flat.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
          <Table2 size={16} strokeWidth={2} />
        </span>
        <span className="text-[15px] font-medium text-[var(--color-ink)]">
          {flat.length} table{flat.length === 1 ? "" : "s"} detected
        </span>
        <span className="ml-auto flex items-center gap-1 text-[12px] text-[var(--color-muted)]">
          layout only · no OCR
          <ChevronDown
            size={16}
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-5">
          {flat.map(({ page, key, table }) => (
            <div key={key}>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                Page {page}
              </div>
              <div className="overflow-x-auto rounded-lg border border-[var(--color-line)]">
                <table className="w-full border-collapse text-[13px]">
                  <tbody>
                    {table.rows.map((row, ri) => (
                      <tr
                        key={ri}
                        className={ri === 0 ? "bg-[var(--color-accent-soft)]" : ""}
                      >
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            className={`border border-[var(--color-line)] px-2.5 py-1.5 align-top ${
                              ri === 0
                                ? "font-semibold text-[var(--color-ink)]"
                                : "text-[#334155]"
                            }`}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
