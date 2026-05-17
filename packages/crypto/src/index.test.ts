import { describe, expect, test } from 'vitest';
import {
  generateKey,
  generateDEK,
  wrapDEK,
  unwrapDEK,
  encryptSecret,
  decryptSecret,
  sealToBase64,
  sealFromBase64,
  loadMEK,
  bytesToBase64,
  sha256Hex,
} from './index';

describe('envelope encryption', () => {
  test('seal/open roundtrip with a string secret', async () => {
    const dek = generateDEK();
    const sealed = await encryptSecret('sk-test-123-very-secret', dek);
    const opened = await decryptSecret(sealed, dek);
    expect(opened).toBe('sk-test-123-very-secret');
  });

  test('DEK wrap/unwrap roundtrip', async () => {
    const mek = generateKey();
    const dek = generateDEK();
    const wrapped = await wrapDEK(dek, mek);
    const unwrapped = await unwrapDEK(wrapped, mek);
    expect(unwrapped).toEqual(dek);
  });

  test('two-layer envelope: MEK wraps DEK, DEK encrypts secret', async () => {
    const mek = generateKey();
    const dek = generateDEK();
    const wrappedDEK = await wrapDEK(dek, mek);
    const sealedSecret = await encryptSecret('my-real-openai-key', dek);

    // Simulate retrieval: unwrap DEK with MEK, then decrypt secret
    const unwrappedDEK = await unwrapDEK(wrappedDEK, mek);
    const recovered = await decryptSecret(sealedSecret, unwrappedDEK);
    expect(recovered).toBe('my-real-openai-key');
  });

  test('wrong MEK fails to unwrap DEK', async () => {
    const mek1 = generateKey();
    const mek2 = generateKey();
    const dek = generateDEK();
    const wrapped = await wrapDEK(dek, mek1);
    await expect(unwrapDEK(wrapped, mek2)).rejects.toThrow();
  });

  test('wrong DEK fails to decrypt secret', async () => {
    const dek1 = generateDEK();
    const dek2 = generateDEK();
    const sealed = await encryptSecret('secret', dek1);
    await expect(decryptSecret(sealed, dek2)).rejects.toThrow();
  });

  test('base64 roundtrip preserves ciphertext + nonce', async () => {
    const dek = generateDEK();
    const sealed = await encryptSecret('hello', dek);
    const b64 = sealToBase64(sealed);
    const back = sealFromBase64(b64);
    const opened = await decryptSecret(back, dek);
    expect(opened).toBe('hello');
  });

  test('different nonces produce different ciphertexts for same plaintext+key', async () => {
    const dek = generateDEK();
    const s1 = await encryptSecret('same', dek);
    const s2 = await encryptSecret('same', dek);
    expect(bytesToBase64(s1.ciphertext)).not.toBe(bytesToBase64(s2.ciphertext));
    expect(bytesToBase64(s1.nonce)).not.toBe(bytesToBase64(s2.nonce));
  });

  test('loadMEK validates length', () => {
    const valid = bytesToBase64(generateKey());
    expect(() => loadMEK(valid)).not.toThrow();
    expect(() => loadMEK('')).toThrow();
    expect(() => loadMEK(bytesToBase64(new Uint8Array(16)))).toThrow();
  });

  test('sha256Hex produces consistent 64-char hex', async () => {
    const a = await sha256Hex('hello');
    const b = await sha256Hex('hello');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await sha256Hex('hello')).not.toBe(await sha256Hex('Hello'));
  });
});
