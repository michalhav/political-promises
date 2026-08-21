/**
 * Společný typ databáze pro doménový kód.
 *
 * Produkce jede na node-postgres, integrační testy na PGlite. Kdyby si moduly
 * braly konkrétní driver, nešlo by je otestovat proti skutečnému Postgresu bez
 * běžící služby. Driver je detail infrastruktury, doména o něm nemá vědět.
 */
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type * as schema from "@/db/schema";

export type AppDatabase = PgDatabase<
  PgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;
