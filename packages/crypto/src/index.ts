/**
 * Envelope encryption for the API Key Wallet.
 *
 * Layers (top → bottom):
 *   - MEK (Master Encryption Key) — app-wide, 256-bit, stored in Cloudflare Workers Secret + Vercel env.
 *   - DEK (Data Encryption Key)   — per-user, 256-bit, AES-256-GCM-wrapped by MEK, stored in DB.
 *   - Root API key plaintext      — AES-256-GCM-encrypted with the user's DEK, stored in DB.
 *
 * All cipher operations use Web Crypto (crypto.subtle), which works in Cloudflare Workers,
 * modern Node (>=20), and modern browsers. No Node-only APIs.
 */

const AES_GCM = 'AES-GCM';
const KEY_BYTES = 32; // 256 bits
const NONCE_BYTES = 12; // 96 bits, AES-GCM standard

export interface SealedBytes {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
}

export interface SealedBytesB64 {
  ciphertext: string; // base64
  nonce: string; // base64
}

/**
 * Web Crypto's BufferSource requires Uint8Array<ArrayBuffer> (not ArrayBufferLike),
 * which differs from the default Uint8Array generic in newer TS lib defs. Narrowing
 * cast here keeps every call site clean.
 */
function bs(b: Uint8Array): BufferSource {
  return b as unknown as BufferSource;
}

/* -----------------------------------------------------------------------------
 * Low-level helpers
 * -------------------------------------------------------------------------- */

/** Generate a new 256-bit random key (raw bytes). */
export function generateKey(): Uint8Array {
  const buf = new Uint8Array(KEY_BYTES);
  crypto.getRandomValues(buf);
  return buf;
}

/** Import raw key bytes as a non-extractable CryptoKey for AES-GCM. */
async function importKey(rawKey: Uint8Array): Promise<CryptoKey> {
  if (rawKey.byteLength !== KEY_BYTES) {
    throw new Error(`Key must be exactly ${KEY_BYTES} bytes; got ${rawKey.byteLength}`);
  }
  return crypto.subtle.importKey('raw', bs(rawKey), AES_GCM, false, ['encrypt', 'decrypt']);
}

/** Encrypt arbitrary bytes with the given 32-byte key. */
export async function seal(plaintext: Uint8Array, key: Uint8Array): Promise<SealedBytes> {
  const cryptoKey = await importKey(key);
  const nonce = new Uint8Array(NONCE_BYTES);
  crypto.getRandomValues(nonce);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: AES_GCM, iv: bs(nonce) }, cryptoKey, bs(plaintext)),
  );
  return { ciphertext, nonce };
}

/** Decrypt bytes produced by seal(). Throws on tag mismatch (wrong key or tampering). */
export async function open(sealed: SealedBytes, key: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await importKey(key);
  return new Uint8Array(
    await crypto.subtle.decrypt(
      { name: AES_GCM, iv: bs(sealed.nonce) },
      cryptoKey,
      bs(sealed.ciphertext),
    ),
  );
}

/* -----------------------------------------------------------------------------
 * Per-user DEK lifecycle
 * -------------------------------------------------------------------------- */

/** Generate a new per-user DEK. */
export function generateDEK(): Uint8Array {
  return generateKey();
}

/** Wrap a DEK with the app-wide MEK. */
export async function wrapDEK(dek: Uint8Array, mek: Uint8Array): Promise<SealedBytes> {
  return seal(dek, mek);
}

/** Unwrap a DEK with the app-wide MEK. */
export async function unwrapDEK(wrapped: SealedBytes, mek: Uint8Array): Promise<Uint8Array> {
  return open(wrapped, mek);
}

/* -----------------------------------------------------------------------------
 * Root-API-key encrypt/decrypt
 * -------------------------------------------------------------------------- */

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Encrypt a string secret with the user's DEK. */
export async function encryptSecret(plaintext: string, dek: Uint8Array): Promise<SealedBytes> {
  return seal(enc.encode(plaintext), dek);
}

/** Decrypt a string secret with the user's DEK. */
export async function decryptSecret(sealed: SealedBytes, dek: Uint8Array): Promise<string> {
  const bytes = await open(sealed, dek);
  return dec.decode(bytes);
}

/* -----------------------------------------------------------------------------
 * Base64 helpers (for DB storage / JSON transport)
 * -------------------------------------------------------------------------- */

export function bytesToBase64(b: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]!);
  return btoa(bin);
}

export function base64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function sealToBase64(s: SealedBytes): SealedBytesB64 {
  return { ciphertext: bytesToBase64(s.ciphertext), nonce: bytesToBase64(s.nonce) };
}

export function sealFromBase64(s: SealedBytesB64): SealedBytes {
  return { ciphertext: base64ToBytes(s.ciphertext), nonce: base64ToBytes(s.nonce) };
}

/* -----------------------------------------------------------------------------
 * Convenience: load MEK from env-style base64
 * -------------------------------------------------------------------------- */

/** Decode an env-supplied base64 MEK into raw bytes; throws if not 32 bytes. */
export function loadMEK(mekBase64: string): Uint8Array {
  if (!mekBase64) throw new Error('MEK env var is empty');
  const bytes = base64ToBytes(mekBase64);
  if (bytes.byteLength !== KEY_BYTES) {
    throw new Error(`MEK must be exactly ${KEY_BYTES} bytes (base64); got ${bytes.byteLength}`);
  }
  return bytes;
}

/* -----------------------------------------------------------------------------
 * Hashing — used for virtual-key lookups and vendor client_secret storage
 * -------------------------------------------------------------------------- */

/** SHA-256 hash of a UTF-8 string, returned as hex. */
export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', bs(enc.encode(input)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
