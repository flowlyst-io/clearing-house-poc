"use client";

import { useEffect, useState } from "react";
import type { District } from "./types";
import { SEED_DISTRICTS } from "./seed";

// localStorage is the contract pool for the POC (per the README — "local storage
// is fine for now"). On first load we seed the three peer districts.

const KEY = "clearinghouse.districts.v1";
const EVT = "clearinghouse:districts-changed";

function read(): District[] {
  if (typeof window === "undefined") return SEED_DISTRICTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      window.localStorage.setItem(KEY, JSON.stringify(SEED_DISTRICTS));
      return SEED_DISTRICTS;
    }
    return JSON.parse(raw) as District[];
  } catch {
    return SEED_DISTRICTS;
  }
}

/** Thrown when even after reclaiming space the pool won't fit in localStorage. */
export class StorageFullError extends Error {
  constructor() {
    super(
      "Your browser's local storage is full. Remove a contract (Discard in Review) and try again.",
    );
    this.name = "StorageFullError";
  }
}

function commit(districts: District[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(districts));
    window.dispatchEvent(new Event(EVT));
    return true;
  } catch (e) {
    // QuotaExceededError (name/code varies across browsers).
    if (
      e instanceof DOMException &&
      (e.name === "QuotaExceededError" ||
        e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
        e.code === 22)
    ) {
      return false;
    }
    throw e;
  }
}

function write(districts: District[]) {
  if (typeof window === "undefined") return;
  if (commit(districts)) return;

  // Quota exceeded. The big payload is each district's stored document text
  // (`pages`), only needed by the Review reader. Shed it oldest-first and retry;
  // a district without `pages` simply falls back to the no-document review view.
  const shed = districts.map((d) => ({ ...d }));
  const oldestFirst = [...shed].sort((a, b) => a.createdAt - b.createdAt);
  for (const d of oldestFirst) {
    if (!d.pages) continue;
    d.pages = undefined;
    if (commit(shed)) return;
  }
  throw new StorageFullError();
}

export function getDistricts(): District[] {
  return read();
}

export function addDistrict(d: District) {
  write([...read(), d]);
}

export function updateDistrict(id: string, patch: Partial<District>) {
  write(read().map((d) => (d.id === id ? { ...d, ...patch } : d)));
}

export function removeDistrict(id: string) {
  write(read().filter((d) => d.id !== id));
}

export function resetToSeed() {
  write(SEED_DISTRICTS);
}

/** Reactive view of the pool. Re-renders on any change in this or another tab. */
export function useDistricts(): District[] {
  const [districts, setDistricts] = useState<District[]>(SEED_DISTRICTS);

  useEffect(() => {
    const sync = () => setDistricts(read());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return districts;
}
