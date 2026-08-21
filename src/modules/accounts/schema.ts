/**
 * Redakční účet a přihlašovací session.
 *
 * Role tu vědomě nejsou. Jediné dělení, které produkt potřebuje, je pravidlo
 * čtyř očí — a to nezní "reviewer smí schvalovat", ale "nikdo nesmí schválit
 * vlastní práci". To je vlastnost dvojice (autor, schvalovatel), ne vlastnost
 * uživatele, a drží ji CHECK constraint na hodnocení. Role by k tomu nic
 * nepřidaly a zavedly by matici oprávnění, kterou brief zakazuje.
 */
import {
  pgTable,
  boolean,
  char,
  index,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

import { createdAt, pk, updatedAt } from "@/db/columns";

export const appUsers = pgTable(
  "app_user",
  {
    id: pk(),
    email: varchar("email", { length: 320 }).notNull(),
    displayName: varchar("display_name", { length: 200 }).notNull(),
    /** scrypt: `N$r$p$sůl$hash`, vše hex. Nikdy neopouští server. */
    passwordHash: varchar("password_hash", { length: 512 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("app_user_email_uq").on(t.email)],
);

/**
 * Session drží jen otisk tokenu, ne token sám. Kdyby někdo získal přístup
 * k databázi, nesmí z ní umět odvodit platnou cookie.
 */
export const appSessions = pgTable(
  "app_session",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("app_session_token_hash_uq").on(t.tokenHash),
    index("app_session_user_idx").on(t.userId),
    index("app_session_expires_idx").on(t.expiresAt),
  ],
);

/**
 * Neúspěšné pokusy o přihlášení.
 *
 * Musí být v databázi, ne v paměti procesu: na Vercelu je každý požadavek
 * potenciálně jiná instance, takže čítač v paměti by po prvním cold startu
 * nechránil nic.
 *
 * Ukládá se otisk IP, ne IP sama. Není to anonymizace — adres je málo a otisk
 * jde dohledat hrubou silou — ale znamená to, že se v databázi nehromadí
 * čitelné adresy návštěvníků. Záznamy se navíc po vypršení okna mažou, takže
 * doba uchování odpovídá účelu (B4).
 */
export const loginAttempts = pgTable(
  "login_attempt",
  {
    id: pk(),
    /** E-mail z formuláře, malými písmeny. Zaznamenává se i u neexistujícího účtu. */
    emailKey: varchar("email_key", { length: 320 }).notNull(),
    ipHash: char("ip_hash", { length: 64 }),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("login_attempt_email_idx").on(t.emailKey, t.attemptedAt),
    index("login_attempt_ip_idx").on(t.ipHash, t.attemptedAt),
  ],
);

export const appUserRelations = relations(appUsers, ({ many }) => ({
  sessions: many(appSessions),
}));

export const appSessionRelations = relations(appSessions, ({ one }) => ({
  user: one(appUsers, { fields: [appSessions.userId], references: [appUsers.id] }),
}));
