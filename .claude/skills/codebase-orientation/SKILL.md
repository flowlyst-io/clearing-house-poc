---
name: codebase-orientation
description: Read at the start of any session working on the clearing-house-poc repo. Orientation to the AI contract-comparison app — architecture, the Upload→Parse→Review→Compare arc, conventions, setup/commands, and the accuracy-first design constraints to respect.
---

# clearing-house-poc — codebase orientation

Read this once at the start of a session to work correctly from the first message.
For deeper context see `README.md` (product, timeline, working model) and
`design_handoff_clearinghouse_redesign/README.md` (visual spec).

## What this is

An AI-assisted contract-comparison POC for BOCES school districts (Putnam–Northern
Westchester, ~60 districts). Districts upload collective bargaining agreements (CBAs),
the app parses them into a fixed taxonomy, a human verifies flagged sections, and
contracts are compared side-by-side with their source language visible.

The arc is four screens: **Upload → Parse → Review → Compare**.

Guiding principles (from the README): **hybrid AI + human**, **accuracy over flash**,
and **never fail silently** — low-confidence extractions and uncategorized content
always bubble up to a human rather than being hidden.

## Stack

- **Next.js 15** (App Router), **React 19**, **TypeScript**, **Tailwind CSS v4**
- **Drizzle ORM + Neon Postgres** (serverless HTTP driver)
- **Anthropic SDK** — `claude-sonnet-4-6` for parsing, `claude-haiku-4-5` for summaries
- **pdfjs-dist** — PDF text extraction, **in the browser** (file never leaves the client)

## Architecture & data flow

1. **Upload** — the browser extracts PDF text per-page via `lib/pdf.ts`
   (`extractPdfText`). The PDF itself never hits the server.
2. **Parse** — extracted text is POSTed to `/api/parse`, which calls Claude Sonnet to
   extract the contract into the 15-section taxonomy with confidence + verbatim anchors.
3. **Store** — the result is saved as one row via `/api/districts` (`inPool: false`).
4. **Review** — a human verifies flagged sections in a document reader (anchors drive
   highlighting); each edit PATCHes the district.
5. **Compare** — pooled districts (`inPool: true`) are shown in a matrix with
   client-computed stats and an AI prose synthesis from `/api/summarize`.

**Data model is document-oriented.** A single `districts` table
(`lib/db/schema.ts`) holds everything; `sections`, `unmatched`, and `pages` are JSONB
columns, so the app reads/writes a whole district atomically — no joins, no
transactions. The row maps 1:1 to the `District` type. `pages` can be large, so it is
**omitted from the list query** and only returned when fetching a single district.

**Client state** lives in `lib/store.ts`: `useDistricts()` is a reactive hook;
mutations (`addDistrict`/`updateDistrict`/`removeDistrict`) call the API then dispatch
a `clearinghouse:districts-changed` event so every hook refetches — Sidebar, Review
tabs, and Compare stay in sync without a central state manager.

## Map of key files

| Path | Purpose |
|------|---------|
| `app/page.tsx` | Home: hero + 4-step arc |
| `app/upload/page.tsx` | Upload: PDF drop, client extraction, parse trigger |
| `app/review/page.tsx` | Review: document reader + inline section editor |
| `app/compare/page.tsx` | Compare: filter rail, matrix, range bars, AI synthesis |
| `app/layout.tsx`, `app/components/Sidebar.tsx` | Shell, nav, pool/review counts |
| `app/api/parse/route.ts` | POST: extract contract via Sonnet → taxonomy + anchors |
| `app/api/summarize/route.ts` | POST: prose overview via Haiku (no numbers invented) |
| `app/api/districts/route.ts` | GET list (no `pages`) / POST create |
| `app/api/districts/[id]/route.ts` | GET (with `pages`) / PATCH / DELETE one district |
| `lib/types.ts` | Domain types: `ParsedSection`, `District`, `ParseResult`, … |
| `lib/taxonomy.ts` | The 15-section comparison schema |
| `lib/db/schema.ts` | Drizzle `districts` table |
| `lib/db/index.ts` | Lazy Neon/Drizzle singleton |
| `lib/db/serialize.ts` | `rowToDistrict` / `patchToColumns` type bridge |
| `lib/db/seed.ts` | Seed runner (`npm run db:seed`) |
| `lib/seed.ts` | `SEED_DISTRICTS` data (pre-vetted peer districts) |
| `lib/anthropic.ts` | Client singleton + `PARSE_MODEL` / `SUMMARIZE_MODEL` |
| `lib/apiError.ts` | Anthropic-aware error → HTTP response |
| `lib/pdf.ts` | `extractPdfText` (browser, per-page) |
| `lib/store.ts` | Client store + cross-tab sync event |
| `lib/anchor.ts` | `locate()` / `buildSegments()` for document highlighting |
| `lib/values.ts` | Deterministic value parsing + min/max/median stats |
| `lib/colors.ts` | District color assignment |
| `lib/sample.ts` | Sample CBA text for the demo |

## The 15-section taxonomy

Defined in `lib/taxonomy.ts`, grouped **Scope / Compensation / Leave / Process**. Each
entry has a `key`, `label`, `description`, `valueHint`, `valueKind`
(number/money/percent/text), `unit`, and `group`. **All 15 keys always appear in parse
output**, each marked `found: true/false` — the app never silently drops a section.

## Conventions

- **Pages** (`app/**/page.tsx`) are client components (`"use client"`). They call
  `lib/store.ts` functions, never the DB directly.
- **API routes** (`app/api/**/route.ts`) are server-only (Node runtime). They are the
  only place that imports `lib/db/*` and `lib/anthropic.ts` — the API key stays server-side.
- **Domain types** live in `lib/types.ts`; **DB row types** are inferred from the schema
  (`DistrictRow` / `NewDistrictRow`). Convert between them with `lib/db/serialize.ts`.
- Import via the `@/*` path alias (e.g. `@/lib/types`).
- **Adding an API route** → follow `app/api/districts/[id]/route.ts`: validate input,
  use `db` + serialize helpers, return the full row, classify errors via `lib/apiError.ts`.
- **Adding a client mutation** → add it to `lib/store.ts` and call `notify()` so the
  `clearinghouse:districts-changed` event refreshes all consumers.

## Setup & commands

Copy `.env.example` → `.env.local` and set `ANTHROPIC_API_KEY` and `DATABASE_URL`
(Neon Postgres). Both are read server-side only.

```bash
npm run dev        # Next.js dev server (http://localhost:3000)
npm run build      # production build
npm run db:push    # sync Drizzle schema to Neon
npm run db:seed    # insert SEED_DISTRICTS (idempotent — stable ids)
npm run lint       # ESLint
```

The DB connection is built lazily on first query (`lib/db/index.ts`), so `next build`
does not require `DATABASE_URL`. `db:seed` is idempotent via stable seed ids
(`seed-maplewood`, …) — safe to re-run.

## Design constraints to respect (do NOT break)

- **Stats are deterministic, never AI.** Min/max/median come from `lib/values.ts` on the
  client. `/api/summarize` writes prose only and must not invent numbers.
- **Anchors stay verbatim/unrepaired.** Parse returns a 6–15 word substring that must
  match the source text exactly so `lib/anchor.ts` can highlight it. Do not "fix" OCR
  in anchors.
- **Low confidence auto-flags.** Sections with `confidence < 0.75` are marked
  `status: "flagged"` for human review — keep that floor.
- **`pages` is excluded from the list query** for payload size; only the single-district
  GET returns it. Don't add `pages` to the list response.
- **PDF text is extracted client-side**; the PDF never goes to the server. Keep it that way.
- **Design fidelity** to `design_handoff_clearinghouse_redesign/` (gitignored design
  assets) — match its tokens/layout when touching UI.

## Where to look next

- `README.md` — product vision, BOCES context, POC timeline, team/working model, open questions.
- `design_handoff_clearinghouse_redesign/README.md` — design tokens, screen-by-screen spec, screenshots.
