/**
 * PKCE (RFC 7636) helpers. Use S256 challenge method.
 */

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Generate a cryptographically random URL-safe string. */
export function randomUrlSafe(byteLen = 32): string {
  const buf = new Uint8Array(byteLen);
  crypto.getRandomValues(buf);
  return bytesToBase64Url(buf);
}

/** Hash a PKCE code_verifier (S256). */
export async function sha256Base64Url(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', enc);
  return bytesToBase64Url(new Uint8Array(hash));
}

/** Generate a fresh verifier+challenge pair. */
export async function generatePkcePair(): Promise<{
  verifier: string;
  challenge: string;
  method: 'S256';
}> {
  const verifier = randomUrlSafe(48); // 64 chars after base64url encoding
  const challenge = await sha256Base64Url(verifier);
  return { verifier, challenge, method: 'S256' };
}
