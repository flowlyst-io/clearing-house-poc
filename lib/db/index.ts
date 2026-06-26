import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Lazy singleton. The connection is built on first query, NOT at import time, so
// `next build` (which imports the route modules) doesn't require DATABASE_URL to
// be present — only an actual request does. Neon's HTTP driver is stateless: a
// fresh query per call, which suits serverless route handlers.
type DB = NeonHttpDatabase<typeof schema>;

let cached: DB | null = null;

function getDb(): DB {
  if (!cached) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL is not set — add it to .env.local (see .env.example).",
      );
    }
    cached = drizzle(neon(process.env.DATABASE_URL), { schema });
  }
  return cached;
}

export const db = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
