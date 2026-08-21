import { describe, expect, it } from "vitest";

import { formatAge, formatAgo } from "@/shared/format";

/**
 * Stáří položky ve frontě.
 *
 * Testuje se hlavně skloňování. České číslovky mají tři tvary a hranice mezi
 * nimi je na pětce — je to přesně ten druh detailu, který se v redakčním
 * nástroji čte stokrát denně a při chybě působí nedbale.
 */
describe("formatAge", () => {
  const now = new Date("2026-08-21T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);

  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  it("čerstvou položku neoznačí číslem", () => {
    expect(formatAge(ago(30_000), now)).toBe("právě teď");
  });

  it("skloňuje hodiny", () => {
    expect(formatAge(ago(HOUR), now)).toBe("1 hodinu");
    expect(formatAge(ago(3 * HOUR), now)).toBe("3 hodiny");
    expect(formatAge(ago(7 * HOUR), now)).toBe("7 hodin");
  });

  it("skloňuje dny", () => {
    expect(formatAge(ago(DAY), now)).toBe("1 den");
    expect(formatAge(ago(3 * DAY), now)).toBe("3 dny");
    expect(formatAge(ago(9 * DAY), now)).toBe("9 dní");
  });

  it("přechází z minut na hodiny a ze dnů na měsíce", () => {
    expect(formatAge(ago(59 * MINUTE), now)).toBe("59 min");
    expect(formatAge(ago(23 * HOUR), now)).toBe("23 hodin");
    expect(formatAge(ago(31 * DAY), now)).toBe("1 měsíc");
    expect(formatAge(ago(200 * DAY), now)).toBe("6 měsíců");
  });

  it("položku z budoucnosti nespočítá jako starou", () => {
    // Hodiny na serveru a v databázi se můžou o pár sekund rozejít.
    expect(formatAge(new Date(now.getTime() + 5_000), now)).toBe("právě teď");
  });
});

/**
 * Tentýž časový odstup, ale ve větě „před …".
 *
 * Po předložce „před" stojí instrumentál, takže tvary jsou jiné než u
 * [formatAge] — a u čerstvé položky se předložka vynechává úplně. Kdyby si
 * volající lepil „před" před výstup `formatAge`, dostal by „před 1 den".
 */
describe("formatAgo", () => {
  const now = new Date("2026-08-21T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);

  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  it("u čerstvé položky předložku vynechá", () => {
    expect(formatAgo(ago(30_000), now)).toBe("právě teď");
  });

  it("skloňuje do instrumentálu", () => {
    expect(formatAgo(ago(MINUTE), now)).toBe("před 1 minutou");
    expect(formatAgo(ago(12 * MINUTE), now)).toBe("před 12 minutami");
    expect(formatAgo(ago(HOUR), now)).toBe("před 1 hodinou");
    expect(formatAgo(ago(7 * HOUR), now)).toBe("před 7 hodinami");
    expect(formatAgo(ago(DAY), now)).toBe("před 1 dnem");
    expect(formatAgo(ago(9 * DAY), now)).toBe("před 9 dny");
    expect(formatAgo(ago(31 * DAY), now)).toBe("před 1 měsícem");
    expect(formatAgo(ago(200 * DAY), now)).toBe("před 6 měsíci");
  });

  it("drží stejné hranice jako formatAge", () => {
    expect(formatAgo(ago(59 * MINUTE), now)).toBe("před 59 minutami");
    expect(formatAgo(ago(23 * HOUR), now)).toBe("před 23 hodinami");
    expect(formatAgo(new Date(now.getTime() + 5_000), now)).toBe("právě teď");
  });
});
