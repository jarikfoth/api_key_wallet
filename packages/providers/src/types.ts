import type { Provider } from '@akw/db';

export type { Provider };

export interface ForwardRequest {
  /** Original Request hitting our proxy. */
  req: Request;
  /** Path after `/<provider>` (e.g. `/v1/chat/completions`). */
  subpath: string;
  /** Decrypted root API key for the user. */
  rootKey: string;
}

export interface MeteringResult {
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  audioSeconds: number | null;
  costCents: number;
}

export interface ForwardResult {
  /** Response to return to the caller. */
  response: Response;
  /** Resolves after the response body has finished streaming, with usage info. */
  metering: Promise<MeteringResult>;
}

export interface ProviderAdapter {
  name: Provider;
  forward(args: ForwardRequest): Promise<ForwardResult>;
  /** Extract the model name from a parsed request body (for pre-flight allowlist check). */
  extractRequestedModel(body: unknown): string | null;
}
