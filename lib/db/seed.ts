import { config } from "dotenv";

// Load env BEFORE importing the db client (it reads DATABASE_URL at import time).
config({ path: ".env.local" });
config();

async function main() {
  // Dynamic imports so the dotenv calls above run first.
  const { db } = await import("./index");
  const { districts } = await import("./schema");
  const { SEED_DISTRICTS } = await import("../seed");

  // Idempotent: stable seed ids (seed-maplewood, …) make this a no-op on re-run.
  const rows = SEED_DISTRICTS.map((d) => ({
    id: d.id,
    name: d.name,
    term: d.term,
    source: d.source,
    inPool: d.inPool,
    sections: d.sections,
    unmatched: d.unmatched ?? [],
    rawText: d.rawText ?? null,
    createdAt: d.createdAt,
  }));

  const inserted = await db
    .insert(districts)
    .values(rows)
    .onConflictDoNothing({ target: districts.id })
    .returning({ id: districts.id });

  console.log(
    `Seed complete: ${inserted.length} inserted, ${
      rows.length - inserted.length
    } already present.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
