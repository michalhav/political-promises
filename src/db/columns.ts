/** Sloupcové helpery, aby se PK a timestampy nepsaly v každé tabulce znovu jinak. */
import { sql } from "drizzle-orm";
import { timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const pk = () =>
  uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`);

export const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/** Slug je veřejná část URL — držíme ho krátký a bez diakritiky. */
export const slug = () => varchar("slug", { length: 120 }).notNull();
