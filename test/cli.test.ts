import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { run } from "../src/cli.js";
import type { Ctx } from "../src/commands.js";
import { readStoredCredentials } from "../src/credentials.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "vehicles-cli-"));
});

afterEach(async () => {
  await rm(dir, { force: true, recursive: true });
});

function stubFetch(handler: (url: string) => Response): typeof globalThis.fetch {
  return (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    return handler(url);
  }) as typeof globalThis.fetch;
}

function makeCtx(options: { env?: NodeJS.ProcessEnv; fetch?: typeof globalThis.fetch }): {
  ctx: Ctx;
  out: string[];
  err: string[];
} {
  const out: string[] = [];
  const err: string[] = [];
  const ctx: Ctx = {
    env: { VEHICLES_CONFIG_DIR: dir, ...options.env },
    log: (message) => out.push(message),
    error: (message) => err.push(message),
    fetch: options.fetch ?? stubFetch(() => new Response("", { status: 400 })),
    stdin: process.stdin,
    stdout: process.stdout
  };
  return { ctx, out, err };
}

describe("run", () => {
  it("prints help and exits 0", async () => {
    const { ctx, out } = makeCtx({});
    expect(await run(["--help"], ctx)).toBe(0);
    expect(out.join("\n")).toContain("Usage:");
  });

  it("prints a semver version", async () => {
    const { ctx, out } = makeCtx({});
    expect(await run(["--version"], ctx)).toBe(0);
    expect(out[0]).toMatch(/^\d+\.\d+\.\d+$/u);
  });

  it("rejects an unknown command", async () => {
    const { ctx, err } = makeCtx({});
    expect(await run(["frobnicate"], ctx)).toBe(1);
    expect(err.join("\n")).toContain("Unknown command");
  });

  it("logs in with a verified key and stores it", async () => {
    const fetch = stubFetch((url) =>
      url.endsWith("/v1/vehicles/vin/0")
        ? new Response("", { status: 400 })
        : new Response("", { status: 404 })
    );
    const { ctx, out } = makeCtx({ fetch });
    expect(await run(["login", "--api-key", "vdev_good"], ctx)).toBe(0);
    expect(out.join("\n")).toContain("Logged in");
    expect(await readStoredCredentials(ctx.env)).toEqual({ apiKey: "vdev_good" });
  });

  it("refuses a key the API rejects with 401 and stores nothing", async () => {
    const fetch = stubFetch(() => new Response("", { status: 401 }));
    const { ctx, err } = makeCtx({ fetch });
    expect(await run(["login", "--api-key", "vdev_bad"], ctx)).toBe(1);
    expect(err.join("\n")).toContain("401");
    expect(await readStoredCredentials(ctx.env)).toBeNull();
  });

  it("refuses a key without the vdev_ prefix", async () => {
    const { ctx, err } = makeCtx({});
    expect(await run(["login", "--api-key", "not-a-key"], ctx)).toBe(1);
    expect(err.join("\n")).toContain("vdev_");
  });

  it("decodes a VIN with an env key", async () => {
    const fetch = stubFetch(
      () =>
        new Response(JSON.stringify({ vin: "1FA", vehicle: { make: "Ford" } }), {
          headers: { "content-type": "application/json" },
          status: 200
        })
    );
    const { ctx, out } = makeCtx({ env: { VEHICLES_API_KEY: "vdev_env" }, fetch });
    expect(await run(["decode", "1FA6P8TH1J5100000"], ctx)).toBe(0);
    expect(out.join("\n")).toContain('"make": "Ford"');
  });

  it("tells an unauthenticated user to log in before decoding", async () => {
    const { ctx, err } = makeCtx({});
    expect(await run(["decode", "1FA6P8TH1J5100000"], ctx)).toBe(1);
    expect(err.join("\n")).toContain("vehicles login");
  });

  it("surfaces an API error from decode as a non-zero exit", async () => {
    const fetch = stubFetch(
      () =>
        new Response(JSON.stringify({ title: "Not Found", detail: "Unknown VIN" }), {
          headers: { "content-type": "application/json" },
          status: 404
        })
    );
    const { ctx, err } = makeCtx({ env: { VEHICLES_API_KEY: "vdev_env" }, fetch });
    expect(await run(["decode", "BADVIN"], ctx)).toBe(1);
    expect(err.join("\n")).toContain("Unknown VIN");
  });
});
