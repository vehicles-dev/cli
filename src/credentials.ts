import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { DEFAULT_API_BASE_URL, normalizeBaseUrl } from "./config.js";

/**
 * On-disk credential shape written by `vehicles login` and read by the CLI and the vehicles.dev MCP
 * server. Kept deliberately small and stable: the MCP server parses the same file, so adding required
 * fields here is a breaking change for it.
 */
export interface StoredCredentials {
  readonly apiKey: string;
  /** Present only when the user logged in against a non-default base URL. */
  readonly baseUrl?: string;
}

/** Resolved settings a command actually runs with, after merging env overrides and stored login. */
export interface ResolvedCredentials {
  readonly apiKey: string;
  readonly baseUrl: string;
  /** Where the key came from, for accurate `whoami` output and error messages. */
  readonly source: "environment" | "login";
}

/** The `~/.vehicles` directory, overridable via `VEHICLES_CONFIG_DIR` (used by tests and sandboxes). */
export function configDir(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.VEHICLES_CONFIG_DIR?.trim();
  return override && override.length > 0 ? override : join(homedir(), ".vehicles");
}

export function credentialsPath(env: NodeJS.ProcessEnv = process.env): string {
  return join(configDir(env), "credentials.json");
}

function isStoredCredentials(value: unknown): value is StoredCredentials {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.apiKey !== "string" || record.apiKey.length === 0) return false;
  return record.baseUrl === undefined || typeof record.baseUrl === "string";
}

/** Read stored login, or null when the user has never run `vehicles login` on this machine. */
export async function readStoredCredentials(
  env: NodeJS.ProcessEnv = process.env
): Promise<StoredCredentials | null> {
  let raw: string;
  try {
    raw = await readFile(credentialsPath(env), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${credentialsPath(env)} is not valid JSON. Run \`vehicles login\` again.`);
  }
  if (!isStoredCredentials(parsed)) {
    throw new Error(`${credentialsPath(env)} is missing an apiKey. Run \`vehicles login\` again.`);
  }
  return { apiKey: parsed.apiKey, ...(parsed.baseUrl ? { baseUrl: parsed.baseUrl } : {}) };
}

/** Persist login with locked-down permissions (dir 0700, file 0600) so other users cannot read it. */
export async function writeStoredCredentials(
  credentials: StoredCredentials,
  env: NodeJS.ProcessEnv = process.env
): Promise<string> {
  await mkdir(configDir(env), { mode: 0o700, recursive: true });
  const path = credentialsPath(env);
  await writeFile(path, `${JSON.stringify(credentials, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
  return path;
}

/** Remove stored login. Returns false when there was nothing to remove. */
export async function clearStoredCredentials(
  env: NodeJS.ProcessEnv = process.env
): Promise<boolean> {
  try {
    await rm(credentialsPath(env));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

/**
 * Resolve the key and base URL a command should use. `VEHICLES_API_KEY` always wins so CI and
 * server environments never depend on an interactive login; otherwise the stored login is used.
 * Base URL precedence: `VEHICLES_API_BASE_URL` env, then the stored login's base URL, then the
 * production default. Returns null when the caller is not authenticated at all.
 */
export async function resolveCredentials(
  env: NodeJS.ProcessEnv = process.env
): Promise<ResolvedCredentials | null> {
  const envKey = env.VEHICLES_API_KEY?.trim();
  const envBaseUrl = env.VEHICLES_API_BASE_URL?.trim();
  if (envKey && envKey.length > 0) {
    return {
      apiKey: envKey,
      baseUrl: normalizeBaseUrl(
        envBaseUrl && envBaseUrl.length > 0 ? envBaseUrl : DEFAULT_API_BASE_URL
      ),
      source: "environment"
    };
  }
  const stored = await readStoredCredentials(env);
  if (!stored) return null;
  const baseUrl =
    envBaseUrl && envBaseUrl.length > 0 ? envBaseUrl : (stored.baseUrl ?? DEFAULT_API_BASE_URL);
  return { apiKey: stored.apiKey, baseUrl: normalizeBaseUrl(baseUrl), source: "login" };
}
