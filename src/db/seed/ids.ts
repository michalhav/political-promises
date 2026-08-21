/**
 * Stabilní identifikátory pro seed.
 *
 * Seed musí být deterministický — po `db:reset && db:migrate && db:seed` mají
 * záznamy stejná ID jako předtím, jinak by se rozbily odkazy v testech
 * i v uložených URL. Náhodné UUID by to znemožnilo, ručně vypsaná by byla
 * nečitelná; ID proto odvozujeme z klíče, pod kterým na entitu odkazujeme.
 */
import { createHash } from "node:crypto";

const SEED_NAMESPACE = "slib-skutek:demo-seed:v1";

export function seedId(key: string): string {
  const bytes = createHash("sha256").update(`${SEED_NAMESPACE}:${key}`).digest().subarray(0, 16);
  // Verze a varianta podle RFC 4122, ať je to platné UUID a ne jen náhodný hex.
  bytes.writeUInt8((bytes.readUInt8(6) & 0x0f) | 0x40, 6);
  bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8);

  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

export function contentHash(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}
