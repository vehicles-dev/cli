import { apiGetOk, verifyApiKey, type ApiClientOptions } from "./api.js";
import {
  API_KEY_PREFIX,
  DASHBOARD_KEYS_URL,
  DEFAULT_API_BASE_URL,
  maskApiKey,
  normalizeBaseUrl
} from "./config.js";
import {
  clearStoredCredentials,
  credentialsPath,
  resolveCredentials,
  writeStoredCredentials,
  type StoredCredentials
} from "./credentials.js";
import { promptHidden } from "./prompt.js";

/** Ambient dependencies, injected so commands are unit-testable without touching the real terminal. */
export interface Ctx {
  readonly env: NodeJS.ProcessEnv;
  readonly log: (message: string) => void;
  readonly error: (message: string) => void;
  readonly fetch: typeof globalThis.fetch;
  readonly stdin: NodeJS.ReadableStream & { isTTY?: boolean };
  readonly stdout: NodeJS.WritableStream;
}

export interface LoginOptions {
  readonly apiKey?: string;
  readonly baseUrl?: string;
}

/**
 * Store an API key so future CLI commands and the vehicles.dev MCP server authenticate without an
 * exported environment variable. Prompts (hidden) for the key when one is not passed, verifies it
 * against the API, then writes `~/.vehicles/credentials.json`.
 */
export async function login(options: LoginOptions, ctx: Ctx): Promise<number> {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_API_BASE_URL);
  let apiKey = options.apiKey?.trim();
  if (!apiKey) {
    ctx.log(`Create or copy an API key at ${DASHBOARD_KEYS_URL}`);
    apiKey = await promptHidden("Paste your vehicles.dev API key: ", ctx.stdin, ctx.stdout);
  }
  if (!apiKey) {
    ctx.error("No API key was provided.");
    return 1;
  }
  if (!apiKey.startsWith(API_KEY_PREFIX)) {
    ctx.error(`That does not look like a vehicles.dev key (they start with "${API_KEY_PREFIX}").`);
    return 1;
  }

  const client: ApiClientOptions = { apiKey, baseUrl, fetch: ctx.fetch };
  try {
    if (!(await verifyApiKey(client))) {
      ctx.error("That API key was rejected (401). Check it in the dashboard and try again.");
      return 1;
    }
  } catch (error) {
    ctx.error(`Could not verify the key (${(error as Error).message}); saving it anyway.`);
  }

  const credentials: StoredCredentials = {
    apiKey,
    ...(baseUrl === DEFAULT_API_BASE_URL ? {} : { baseUrl })
  };
  const path = await writeStoredCredentials(credentials, ctx.env);
  ctx.log(`Logged in as ${maskApiKey(apiKey)}. Saved to ${path}.`);
  return 0;
}

/** Forget the stored key. */
export async function logout(ctx: Ctx): Promise<number> {
  const removed = await clearStoredCredentials(ctx.env);
  ctx.log(removed ? "Logged out." : "You were not logged in.");
  return 0;
}

/** Show which key is active, where it came from, and whether it still authenticates. */
export async function whoami(ctx: Ctx): Promise<number> {
  const resolved = await resolveCredentials(ctx.env);
  if (!resolved) {
    ctx.error(`Not logged in. Run \`vehicles login\` or set VEHICLES_API_KEY.`);
    return 1;
  }
  const origin =
    resolved.source === "environment"
      ? "VEHICLES_API_KEY environment variable"
      : credentialsPath(ctx.env);
  ctx.log(`Key:      ${maskApiKey(resolved.apiKey)}`);
  ctx.log(`Source:   ${origin}`);
  ctx.log(`API:      ${resolved.baseUrl}`);
  let valid: boolean;
  try {
    valid = await verifyApiKey({
      apiKey: resolved.apiKey,
      baseUrl: resolved.baseUrl,
      fetch: ctx.fetch
    });
  } catch (error) {
    ctx.error(`Status:   could not reach the API (${(error as Error).message})`);
    return 1;
  }
  if (!valid) {
    ctx.error("Status:   rejected (401) — the key is invalid or revoked.");
    return 1;
  }
  ctx.log("Status:   active");
  return 0;
}

/** Decode a VIN into canonical vehicle identity fields. */
export async function decode(vin: string | undefined, ctx: Ctx): Promise<number> {
  if (!vin) {
    ctx.error("Usage: vehicles decode <VIN>");
    return 1;
  }
  const resolved = await resolveCredentials(ctx.env);
  if (!resolved) {
    ctx.error("Not logged in. Run `vehicles login` first.");
    return 1;
  }
  const client: ApiClientOptions = {
    apiKey: resolved.apiKey,
    baseUrl: resolved.baseUrl,
    fetch: ctx.fetch
  };
  const body = await apiGetOk(client, `/v1/vehicles/vin/${encodeURIComponent(vin)}`);
  ctx.log(JSON.stringify(body, null, 2));
  return 0;
}
