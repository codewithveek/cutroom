/**
 * How to reach Temporal: a plain address for the dev server or a self-hosted cluster, TLS plus an
 * API key for Temporal Cloud. Used by both the client (API) and the native connection (worker).
 */
export function temporalConnectionOptions(options: { address: string; apiKey?: string | undefined }): {
  address: string;
  tls?: true;
  apiKey?: string;
} {
  return options.apiKey
    ? { address: options.address, tls: true, apiKey: options.apiKey }
    : { address: options.address };
}
