export type Scope = 'openai' | 'anthropic' | 'google' | 'deepgram';

export interface ExchangeResult {
  /** Map of provider → virtual key (akw_live_...) usable with the proxy. */
  keys: Partial<Record<Scope, string>>;
  /** Base URL to point your AI SDKs/apps at instead of the provider's URL. */
  base_url: string;
  /** Opaque per-vendor user identifier. Use for your own bookkeeping. */
  user_id: string;
}

export interface StartAuthorizationParams {
  walletBaseUrl: string;          // e.g. 'https://wallet.akw.dev'
  clientId: string;
  redirectUri: string;
  scopes: Scope[];
  /** Optional CSRF token; auto-generated if omitted. */
  state?: string;
}

export interface StartAuthorizationResult {
  /** URL to redirect the user to. */
  url: string;
  /** Store this server-side (keyed by state) — needed for token exchange. */
  codeVerifier: string;
  /** CSRF token; compare against the `state` returned in the callback. */
  state: string;
}
