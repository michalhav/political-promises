import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Pro `generate` se spojení neotevírá; hodnota je potřeba až pro `migrate`/`studio`.
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/unset",
  },
  strict: true,
  verbose: true,
});
