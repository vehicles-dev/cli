#!/usr/bin/env node
import { run } from "./cli.js";
import type { Ctx } from "./commands.js";

const ctx: Ctx = {
  env: process.env,
  log: (message) => process.stdout.write(`${message}\n`),
  error: (message) => process.stderr.write(`${message}\n`),
  fetch: globalThis.fetch,
  stdin: process.stdin,
  stdout: process.stdout
};

process.exitCode = await run(process.argv.slice(2), ctx);
