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

/** scrypt při vyšším N potřebuje víc paměti, než je výchozí limit knihovny. */
const MEMORY_LIMIT = 128 * COST * BLOCK_SIZE * 2;

/** `promisify` si u scryptu neporadí s variantou s options, proto ruční obal. */
function derive(password: string, salt: Buffer, cost: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      KEY_LENGTH,
      { N: cost, r: BLOCK_SIZE, p: PARALLELIZATION, maxmem: MEMORY_LIMIT },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, COST);

  return [COST, BLOCK_SIZE, PARALLELIZATION, salt.toString("hex"), key.toString("hex")].join("$");
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;

  const parts = stored.split("$");
  if (parts.length !== 5) return false;

  const [costRaw, , , saltHex, keyHex] = parts;
  const cost = Number(costRaw);
  if (!Number.isInteger(cost) || cost <= 0 || !saltHex || !keyHex) return false;

  const expected = Buffer.from(keyHex, "hex");
  if (expected.length !== KEY_LENGTH) return false;

  const actual = await derive(password, Buffer.from(saltHex, "hex"), cost);
  return timingSafeEqual(actual, expected);
}
