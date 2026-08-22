/**
 * Hesla redakčních účtů.
 *
 * Scrypt z `node:crypto` — bez další závislosti a je to jedna z funkcí, které
 * OWASP pro hesla doporučuje. Parametry se ukládají spolu s otiskem, aby šlo
 * je do budoucna zvýšit, aniž by se znehodnotily existující účty.
 *
 * Porovnání je vždy v konstantním čase. Naivní `===` prozradí útočníkovi délku
 * shodného prefixu a tím i cestu k uhodnutí otisku.
 */
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/** N=2^15. Kompromis mezi odolností a tím, aby přihlášení trvalo desítky ms. */
const COST = 32_768;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

interface ScryptParams {
  cost: number;
  blockSize: number;
  parallelization: number;
}

/** `promisify` si u scryptu neporadí s variantou s options, proto ruční obal. */
function derive(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      KEY_LENGTH,
      {
        N: params.cost,
        r: params.blockSize,
        p: params.parallelization,
        // Paměť roste s N i r, proto se počítá z použitých parametrů. Pevná
        // hodnota by po zvýšení r shodila ověřování starých otisků.
        maxmem: 128 * params.cost * params.blockSize * 2,
      },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
}

/**
 * Atrapa pro neexistující účet.
 *
 * Přihlašovací formulář odpovídá vždy stejně, ale doteď odpovídal různě
 * **rychle**: u existujícího účtu proběhl scrypt (naměřeno 71 ms), u
 * neexistujícího se hned vrátilo `false` (jednotky ms). Sedmdesátinásobný
 * rozdíl jde přes síť změřit a zjistit tak, kdo v redakci pracuje.
 *
 * Ověření proti atrapě sráží ten rozdíl na šum. Klíč je samá nula, takže se
 * s ničím neshodne — a u neexistujícího účtu se výsledek stejně zahazuje.
 */
const ABSENT_ACCOUNT_RECORD = [
  COST,
  BLOCK_SIZE,
  PARALLELIZATION,
  "00".repeat(SALT_LENGTH),
  "00".repeat(KEY_LENGTH),
].join("$");

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, {
    cost: COST,
    blockSize: BLOCK_SIZE,
    parallelization: PARALLELIZATION,
  });

  return [COST, BLOCK_SIZE, PARALLELIZATION, salt.toString("hex"), key.toString("hex")].join("$");
}

/** Horní meze proti otisku, který by si vyžádal nesmyslně mnoho paměti. */
const MAX_COST = 1 << 20;
const MAX_BLOCK_SIZE = 32;
const MAX_PARALLELIZATION = 16;

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  // U neexistujícího účtu se počítá proti atrapě, aby odpověď trvala stejně
  // dlouho. Výsledek se zahodí — chybějící účet se nikdy nesmí ověřit.
  const record = stored ?? ABSENT_ACCOUNT_RECORD;

  const parts = record.split("$");
  if (parts.length !== 5) return false;

  const [costRaw, blockRaw, parallelRaw, saltHex, keyHex] = parts;
  // Parametry se čtou ze **zapsaného** otisku, ne z konstant. Jinak by jejich
  // zvýšení znehodnotilo všechny existující účty — přesně to, čemu se ukládáním
  // parametrů vedle otisku předchází.
  const params: ScryptParams = {
    cost: Number(costRaw),
    blockSize: Number(blockRaw),
    parallelization: Number(parallelRaw),
  };

  const sane =
    Number.isInteger(params.cost) &&
    params.cost > 0 &&
    params.cost <= MAX_COST &&
    Number.isInteger(params.blockSize) &&
    params.blockSize > 0 &&
    params.blockSize <= MAX_BLOCK_SIZE &&
    Number.isInteger(params.parallelization) &&
    params.parallelization > 0 &&
    params.parallelization <= MAX_PARALLELIZATION;

  if (!sane || !saltHex || !keyHex) return false;

  const expected = Buffer.from(keyHex, "hex");
  if (expected.length !== KEY_LENGTH) return false;

  const actual = await derive(password, Buffer.from(saltHex, "hex"), params);
  const matches = timingSafeEqual(actual, expected);

  return stored === null ? false : matches;
}
