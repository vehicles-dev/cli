import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearStoredCredentials,
  credentialsPath,
  readStoredCredentials,
  resolveCredentials,
  writeStoredCredentials
} from "../src/credentials.js";

let dir: string;
let env: NodeJS.ProcessEnv;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "vehicles-cli-"));
  env = { VEHICLES_CONFIG_DIR: dir };
});

afterEach(async () => {
  await rm(dir, { force: true, recursive: true });
});

describe("credential storage", () => {
  it("round-trips a stored key and writes it with 0600 permissions", async () => {
    const path = await writeStoredCredentials({ apiKey: "vdev_abc123" }, env);
    expect(path).toBe(credentialsPath(env));
    expect(await readStoredCredentials(env)).toEqual({ apiKey: "vdev_abc123" });
    const mode = (await stat(path)).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("preserves a custom base URL", async () => {
    await writeStoredCredentials(
      { apiKey: "vdev_x", baseUrl: "https://staging.vehicles.dev" },
      env
    );
    expect(await readStoredCredentials(env)).toEqual({
      apiKey: "vdev_x",
      baseUrl: "https://staging.vehicles.dev"
    });
  });

  it("returns null when nothing is stored", async () => {
    expect(await readStoredCredentials(env)).toBeNull();
  });

  it("clears stored credentials and reports whether anything was removed", async () => {
    await writeStoredCredentials({ apiKey: "vdev_x" }, env);
    expect(await clearStoredCredentials(env)).toBe(true);
    expect(await clearStoredCredentials(env)).toBe(false);
    expect(await readStoredCredentials(env)).toBeNull();
  });
});

describe("resolveCredentials", () => {
  it("prefers VEHICLES_API_KEY over stored login", async () => {
    await writeStoredCredentials({ apiKey: "vdev_stored" }, env);
    const resolved = await resolveCredentials({ ...env, VEHICLES_API_KEY: "vdev_env" });
    expect(resolved).toEqual({
      apiKey: "vdev_env",
      baseUrl: "https://api.vehicles.dev",
      source: "environment"
    });
  });

  it("falls back to the stored login and its base URL", async () => {
    await writeStoredCredentials(
      { apiKey: "vdev_stored", baseUrl: "https://staging.vehicles.dev" },
      env
    );
    const resolved = await resolveCredentials(env);
    expect(resolved).toEqual({
      apiKey: "vdev_stored",
      baseUrl: "https://staging.vehicles.dev",
      source: "login"
    });
  });

  it("lets VEHICLES_API_BASE_URL override the stored base URL", async () => {
    await writeStoredCredentials(
      { apiKey: "vdev_stored", baseUrl: "https://staging.vehicles.dev" },
      env
    );
    const resolved = await resolveCredentials({
      ...env,
      VEHICLES_API_BASE_URL: "http://localhost:3001/"
    });
    expect(resolved?.baseUrl).toBe("http://localhost:3001");
  });

  it("returns null when neither an env key nor a stored login exists", async () => {
    expect(await resolveCredentials(env)).toBeNull();
  });
});
