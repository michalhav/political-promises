/**
 * Dokument získaný z webového archivu.
 *
 * Programy politických stran z roku 2022 z webů mizí — u dvou ze šesti
 * pražských kandidátek už dnes původní adresa nevede nikam. Jediné, co po nich
 * zbývá, je snímek v archivu. Bez něj by se ty sliby nedaly doložit vůbec.
 *
 * Archivní kopie ale **není totéž co dokument od vydavatele** a čtenář to musí
 * vidět. Rozdíl je věcný, ne formální: u snímku ručí za shodu s originálem
 * třetí strana, a snímek je z konkrétního dne — program mohl vzniknout dřív
 * i později se změnit. Zamlčet to by znamenalo vydávat kopii za originál.
 *
 * Proto se archivní původ **rozpozná z adresy**, ne z přepínače. Kdyby ho
 * vyplňoval člověk, dřív nebo později by ho někdo zapomněl vyplnit a dokument
 * by se tvářil jako stažený od vydavatele.
 */

/** Adresa snímku ve Wayback Machine: /web/<14 číslic><volitelné id_>/<původní adresa>. */
const WAYBACK_PATTERN =
  /^https?:\/\/(?:web\.)?archive\.org\/web\/(\d{14})([a-z]{2}_)?\/(https?:\/\/.+)$/i;

export interface ArchiveOrigin {
  /** Kdo za snímek ručí. */
  service: string;
  /** Adresa, na které dokument původně vydal vydavatel. */
  originalUrl: string;
  /** Kdy archiv snímek pořídil. */
  snapshotAt: Date;
  /**
   * Adresa, ze které se stahuje.
   *
   * Wayback do HTML vkládá vlastní lištu; varianta `id_` vrací archivované
   * **původní bajty**. Rozdíl je 17 kB u programu Pirátů a hlavně stálost:
   * lišta se časem mění, originál ne. Kdybychom stahovali verzi s lištou,
   * otisk by se rozešel při každé úpravě archivu a týdenní kontrola by hlásila
   * změnu dokumentu, ke které nedošlo.
   */
  rawUrl: string;
}

/** Rozloží 14místné razítko Wayback Machine. Je v UTC. */
function parseTimestamp(stamp: string): Date | null {
  const parts = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(stamp);
  if (!parts) return null;

  const [, year, month, day, hour, minute, second] = parts;
  const date = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ),
  );

  // Date.UTC přebere i 31. února a tiše to posune. Kontrola zpět to odhalí.
  if (Number.isNaN(date.getTime())) return null;
  if (date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return null;

  return date;
}

/**
 * Pozná archivní adresu a rozloží ji na původ.
 *
 * Vrací `null` u běžné adresy — volající pak pracuje jako dosud.
 */
export function parseArchiveUrl(url: string): ArchiveOrigin | null {
  const match = WAYBACK_PATTERN.exec(url.trim());
  if (!match) return null;

  const [, stamp, , originalUrl] = match;
  if (!stamp || !originalUrl) return null;

  const snapshotAt = parseTimestamp(stamp);
  if (!snapshotAt) return null;

  return {
    service: "Internet Archive",
    originalUrl,
    snapshotAt,
    rawUrl: `https://web.archive.org/web/${stamp}id_/${originalUrl}`,
  };
}
