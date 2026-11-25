/**
 * UUIDv7 generation. Time-ordered ids keep Postgres b-tree inserts sequential,
 * which matters because every food-log row is generated on-device and synced.
 */

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

export interface UuidDeps {
  now?: () => number;
  randomBytes?: (length: number) => Uint8Array;
}

function defaultRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const globalCrypto = (globalThis as { crypto?: { getRandomValues?: (arr: Uint8Array) => Uint8Array } })
    .crypto;
  if (globalCrypto?.getRandomValues) {
    globalCrypto.getRandomValues(bytes);
    return bytes;
  }
  for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}

export function uuidv7(deps: UuidDeps = {}): string {
  const now = deps.now ?? (() => Date.now());
  const randomBytes = deps.randomBytes ?? defaultRandomBytes;
  let timestamp = BigInt(Math.floor(now()));
  const rand = randomBytes(10);
  const b = new Uint8Array(16);

  for (let i = 5; i >= 0; i -= 1) {
    b[i] = Number(timestamp & 0xffn);
    timestamp >>= 8n;
  }
  b[6] = 0x70 | ((rand[0] ?? 0) & 0x0f);
  b[7] = rand[1] ?? 0;
  b[8] = 0x80 | ((rand[2] ?? 0) & 0x3f);
  for (let i = 3; i < 10; i += 1) b[i + 6] = rand[i] ?? 0;

  const hex = toHex(b);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isUuidV7(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Timestamp encoded in a v7 id — used for conflict resolution diagnostics. */
export function uuidV7Timestamp(value: string): number | null {
  if (!isUuidV7(value)) return null;
  return Number.parseInt(value.replace(/-/g, '').slice(0, 12), 16);
}
