import { bigint, boolean, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import type { ParsedSection, UnmatchedSection } from "../types";

// One document-oriented table. The app always reads a whole district and writes
// its section arrays back wholesale, so sections/unmatched live as JSONB rather
// than separate rows — no joins, no transactions, and the row maps 1:1 to the
// `District` type. `createdAt` stays a bigint epoch-ms to match District.createdAt.
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
  rawText: text("raw_text"), // verbatim extracted PDF text; null for seed
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export type DistrictRow = typeof districts.$inferSelect;
export type NewDistrictRow = typeof districts.$inferInsert;
