# Clearing House POC

A throwaway proof-of-concept for a flowlyst **Contract Clearinghouse** — AI-assisted
contract comparison for school districts. We're building it to show BOCES
(Putnam-Northern Westchester) at our next sync: partly to prove we can replace the tool
they're about to lose, partly to **probe** which direction they want us to take it.

This README is the project's home base. It's a **vision doc, not a spec** — read it to
get oriented, not to find locked requirements. We're working extremely agile; the only
part meant to be "actionable now" is **This week's slice**, and even that is expected to
move. Status: POC · started 2026-06-22.

---

## The moment (why now)

BOCES runs a contract-comparison service for ~60 districts (~200 users, 50–75 of them
regular). It lets a district heading into negotiations pull one clause — say, bereavement
leave — and compare how it's written across districts. The third-party tool it depends on
(run by Bruce Toll; called both *"Black Horse"* and *"Dark Horse"* in the meeting) becomes
unavailable around **July 1**, so they're shopping for a replacement and talking to more
than one vendor.

Today the work behind it is manual and slow: districts send their collective bargaining
agreements, a staffer converts them to PDF and hand-copies the language into standardized
sections so it can be searched and compared. They pay **~$35K/yr** for the service. They
want comparison back ASAP and hope to pick a direction by ~July 1.

## The vision (the durable part)

A contract goes in → AI parses it into that district's section taxonomy → a human verifies
→ users get instant, scannable comparison and insight across districts, with the **source
language one click away**. Over time this becomes a module inside flowlyst, alongside
budget tracking and salary projection.

## Principles (how it should feel)

- **Hybrid, not magic.** AI does the tedious extraction; a human verifies. Never silently
  fail — surface what the AI couldn't categorize so a person can fix it.
- **Accuracy over flash.** These users punish mistakes. A wrong number erodes trust faster
  than a missing feature wins it.
- **Familiar-anchored.** Mirror enough of what they do today that they recognize it, then
  show the upside.
- **Facilitate change.** Smooth, signposted change — not a jarring new world.

## The arc (behaviors, not screens)

- **Upload** — a district's contract (PDF) goes in.
- **Parse** — AI splits it into the district's standardized sections (recognition clause,
  work year, bereavement leave, …).
- **Review** — low-confidence or uncategorized sections flag for a human to confirm or
  re-assign. This is the trust story versus their current cut-and-paste.
- **Compare** — pick districts and a section, see them side by side, with an at-a-glance
  summary of the extracted values and the source language a click away.

## This week's slice (loose — reshuffle freely)

The one part meant to be actionable. It's our current best guess of where to start, and
our stand-in for a ticket board — keep it honest, but change it as we build and as the
demo teaches us.

- **Breadth before depth.** Get the whole arc working end-to-end at low fidelity first,
  then deepen wherever there's time.
- **Compare carries the most weight** (it's where their opinion forms): school cards side
  by side + an AI summary of the values (min / max / median) + click a value to see its
  source language + highlight the key numbers.
- **Parse/review is the trust beat:** at least one contract parses live; flagged sections
  a human can re-assign; "confirm" adds it to the comparison pool.
- **Front-end first**, thin backend only for the AI call (don't expose keys on the
  client); local storage is fine for now.
- **Data:** aim for real BOCES contracts — ask them; their existing categorized sections
  are effectively an answer key for making the parse look accurate. Fall back to seeded
  data if they're slow. **This is the top schedule risk.**

## Not now (explicitly later)

Salary collection (employee-list upload → categorize → benchmark), financial reporting
(ST3), the AI chat ("what's common / different?"), comparing multiple categories at once,
any web-crawler / scheduled ingestion (e.g. seethroughnewyork.com), and polish.

## Working model

- **Jahid drives and owns the build**, self-tracking against *This week's slice*. Tural
  collaborates; Aziz drops in for feedback via the running prototype.
- **No tickets, no PR ceremony** — work how you like. This README is the shared surface;
  keep the decisions log below current.
- One mid-week check-in to reshuffle the slice. Demo to BOCES at the end.
- When we decide this is real and start integrating it into Budget Tracker, *that's* when
  the normal flowlyst workflow (JIRA, the lifecycle, PRs) switches back on.

## Decisions & open questions (living log)

**Decided**
- One prototype, aimed "in the middle" — not a clone of their current UX, not the ideal
  end product.
- Vision doc over spec; no JIRA for the POC phase; normal workflow resumes at
  Budget-Tracker integration.
- POC scope is **contract comparison only** (salary and financial pieces are later).

**Open**
- Do we have real contracts in hand yet? (BOCES to send.)
- Familiar vs. AI-forward — which way do they lean? *The demo is how we find out.*
- How much of parse/review is genuinely live vs. canned, and how interactive review is —
  decide as we build.
