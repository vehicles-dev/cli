/** Product surfaces referenced from help text, errors, and login prompts. */
export const DEFAULT_API_BASE_URL = "https://api.vehicles.dev";
export const DASHBOARD_KEYS_URL = "https://vehicles.dev/dashboard";
export const DOCS_URL = "https://vehicles.dev/docs";
export const SUPPORT_EMAIL = "support@vehicles.dev";

/** Prefix every product API key carries. Used only for a friendly typo check, never for auth. */
export const API_KEY_PREFIX = "vdev_";

/** Per-request ceiling. The slowest documented route budget is 15 s; allow generous headroom. */
export const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Normalize a base URL to an origin plus path with no trailing slash, matching how the SDK and MCP
 * server resolve `/v1/...` paths. Throws on anything that is not an absolute http(s) URL.
 */
export function normalizeBaseUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Not a valid absolute URL: ${raw}. Example: ${DEFAULT_API_BASE_URL}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Base URL must use http or https, got ${parsed.protocol}`);
  }
  return parsed.origin + parsed.pathname.replace(/\/+$/u, "");
}

/** Mask a key for display so it can be printed in `whoami`/`login` without leaking the secret. */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 10) return `${apiKey.slice(0, 2)}…`;
  return `${apiKey.slice(0, 8)}…${apiKey.slice(-4)}`;
}
