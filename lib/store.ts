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

function write(districts: District[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(districts));
  window.dispatchEvent(new Event(EVT));
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
