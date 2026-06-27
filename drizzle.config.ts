import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Next.js keeps secrets in .env.local; load it for this standalone CLI tool
// (fall back to .env). drizzle-kit doesn't read .env.local on its own.
config({ path: ".env.local" });
config();

// `drizzle-kit push` syncs lib/db/schema.ts straight to Neon. For a POC we push
// (no migration files); switch to generate+migrate later if needed.
export default defineConfig({
  schema: "./lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
