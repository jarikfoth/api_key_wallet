/**
 * Minimal browser helper. Most vendors should use the server-side flow
 * (startAuthorization + exchangeCode) for security. This is a thin convenience
 * for redirecting the user to a URL their backend generated.
 */

export function redirectToWallet(url: string): void {
  window.location.href = url;
}
