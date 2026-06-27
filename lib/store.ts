"use client";

import { useEffect, useState } from "react";
import type { District } from "./types";

// The contract pool lives in Neon Postgres, reached through /api/districts. This
// module keeps the same small API the pages already use (useDistricts +
// add/update/remove) so callers barely change. Mutations are async and, on
// success, dispatch EVT — every mounted useDistricts re-fetches in response,
// keeping separate views (Review tabs, Compare) in sync within a tab.
//
// Note: the list (useDistricts) omits each district's `pages` (the document
// text) to keep payloads small. Review fetches a single district via getDistrict
// to render the document reader.

const EVT = "clearinghouse:districts-changed";

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVT));
}

async function fetchDistricts(): Promise<District[]> {
  const res = await fetch("/api/districts");
  if (!res.ok) throw new Error("Failed to load districts");
  return (await res.json()) as District[];
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

export async function addDistrict(d: District): Promise<District> {
  const res = await fetch("/api/districts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(d),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to save district"));
  const created = (await res.json()) as District;
  notify();
  return created;
}

export async function updateDistrict(
  id: string,
  patch: Partial<District>,
): Promise<District> {
  const res = await fetch(`/api/districts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to update district"));
  const updated = (await res.json()) as District;
  notify();
  return updated;
}

export async function removeDistrict(id: string): Promise<void> {
  const res = await fetch(`/api/districts/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await readError(res, "Failed to remove district"));
  notify();
}

/** Fetch a single district WITH its per-page document text (the list omits it). */
export async function getDistrict(id: string): Promise<District> {
  const res = await fetch(`/api/districts/${id}`);
  if (!res.ok) throw new Error(await readError(res, "Failed to load district"));
  return (await res.json()) as District;
}

/** Reactive view of the pool (without `pages`). Re-fetches on any mutation. */
export function useDistricts(): District[] {
  const [districts, setDistricts] = useState<District[]>([]);

  useEffect(() => {
    let active = true;
    const sync = () => {
      fetchDistricts()
        .then((d) => {
          if (active) setDistricts(d);
        })
        .catch(() => {
          /* leave the last good list in place on a transient failure */
        });
    };
    sync();
    window.addEventListener(EVT, sync);
    return () => {
      active = false;
      window.removeEventListener(EVT, sync);
    };
  }, []);

  return districts;
}
