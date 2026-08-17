import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

import { decode, login, logout, whoami, type Ctx } from "./commands.js";
import { DASHBOARD_KEYS_URL, DOCS_URL } from "./config.js";

const HELP = `vehicles — command-line access to the vehicles.dev API

Usage:
  vehicles <command> [options]

Commands:
  login            Store an API key so the CLI and MCP server can authenticate
  logout           Remove the stored API key
  whoami           Show the active key, where it came from, and if it still works
  decode <VIN>     Decode a VIN into canonical vehicle identity fields

Login options:
  --api-key <key>  Provide the key non-interactively (else you are prompted)
  --base-url <url> Point at a non-default API origin (default: https://api.vehicles.dev)

Global:
  -h, --help       Show this help
  -v, --version    Show the CLI version

Authentication:
  \`vehicles login\` saves your key to ~/.vehicles/credentials.json (0600). The
  VEHICLES_API_KEY environment variable, when set, overrides the stored key.

  Get a key at ${DASHBOARD_KEYS_URL}
  Docs: ${DOCS_URL}
`;

function version(): string {
  try {
    const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: unknown };
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/** Parse argv (without the node/script prefix) and run the matching command. Returns an exit code. */
export async function run(argv: readonly string[], ctx: Ctx): Promise<number> {
  const [command, ...rest] = argv;

  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    ctx.log(HELP);
    return 0;
  }
  if (command === "--version" || command === "-v" || command === "version") {
    ctx.log(version());
    return 0;
  }

  try {
    switch (command) {
      case "login": {
        const { values } = parseArgs({
          args: [...rest],
          options: {
            "api-key": { type: "string", short: "k" },
            "base-url": { type: "string" }
          },
          allowPositionals: false
        });
        return await login(
          {
            ...(values["api-key"] ? { apiKey: values["api-key"] } : {}),
            ...(values["base-url"] ? { baseUrl: values["base-url"] } : {})
          },
          ctx
        );
      }
      case "logout":
        return await logout(ctx);
      case "whoami":
        return await whoami(ctx);
      case "decode":
        return await decode(rest[0], ctx);
      default:
        ctx.error(`Unknown command: ${command}\nRun \`vehicles --help\` for usage.`);
        return 1;
    }
  } catch (error) {
    ctx.error((error as Error).message);
    return 1;
  }
}
