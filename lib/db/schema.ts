import { bigint, boolean, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import type { ParsedSection, UnmatchedSection } from "../types";

// One document-oriented table. The app always reads a whole district and writes
// its section arrays back wholesale, so sections/unmatched live as JSONB rather
// than separate rows — no joins, no transactions, and the row maps 1:1 to the
// `District` type. `createdAt` stays a bigint epoch-ms to match District.createdAt.
//
// `pages` holds the per-page extracted PDF text that powers the Review document
// reader. It can be large (a full contract), so it's excluded from the districts
// LIST query and only returned when a single district is fetched by id. It is
// also cleared once a district is pooled (Compare doesn't need it).
export const districts = pgTable("districts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  term: text("term"),
  source: text("source").notNull(), // 'seed' | 'parsed'
  inPool: boolean("in_pool").notNull().default(false),
  sections: jsonb("sections").$type<ParsedSection[]>().notNull().default([]),
  unmatched: jsonb("unmatched")
    .$type<UnmatchedSection[]>()
    .notNull()
    .default([]),
  pages: jsonb("pages").$type<string[]>(), // per-page document text; null for seed/pooled
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export type DistrictRow = typeof districts.$inferSelect;
export type NewDistrictRow = typeof districts.$inferInsert;
