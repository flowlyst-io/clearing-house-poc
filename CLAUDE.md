# CLAUDE.md

**clearing-house-poc** is an AI-assisted contract-comparison POC for BOCES school
districts. The arc is four screens: **Upload → Parse → Review → Compare**. Stack:
Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · Drizzle + Neon Postgres ·
Anthropic SDK · pdfjs-dist.

## Start here

At the start of work on this repo, **read
`.claude/skills/codebase-orientation/SKILL.md`** for full orientation — architecture and
data flow, a map of the key files, conventions, setup/commands, and the design
constraints to respect. For product/timeline context see `README.md`.

## Always remember (do NOT break)

- **Stats are deterministic, never AI.** Min/max/median come from `lib/values.ts` on the
  client; `/api/summarize` writes prose only and must not invent numbers.
- **Anchors stay verbatim.** Parse returns an exact source substring used for
  highlighting (`lib/anchor.ts`) — don't "fix" or repair anchor text.
- **Low confidence auto-flags.** `confidence < 0.75` → `status: "flagged"` for human review.
- **PDF text is extracted client-side** (`lib/pdf.ts`); the PDF never goes to the server.
- **`pages` is omitted from the districts list query** (payload size) — only the
  single-district GET returns it.
- API routes (`app/api/**`) are the only place that imports `lib/db/*` and
  `lib/anthropic.ts`; the Anthropic key stays server-side. Pages are `"use client"` and
  go through `lib/store.ts`.

## Commands

```bash
npm run dev       # dev server (localhost:3000)
npm run build     # production build (no DATABASE_URL needed — lazy DB connection)
npm run db:push   # sync schema to Neon
npm run db:seed   # seed peer districts (idempotent)
npm run lint
```
