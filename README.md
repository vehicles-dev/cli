# vehicles-dev-cli

Official command-line interface for the [vehicles.dev](https://vehicles.dev) API. Log in once, then
decode VINs from your terminal — and the [vehicles.dev MCP server](https://vehicles.dev/mcp) picks up
the same login automatically, so you never have to export an API key.

## Install

```bash
npm install -g vehicles-dev-cli
# or: pnpm add -g vehicles-dev-cli
```

Requires Node.js 22 or newer.

## Quickstart

```bash
vehicles login                     # paste a key from https://vehicles.dev/dashboard
vehicles decode 1FA6P8TH1J5100000  # decode a VIN
```

`vehicles login` prompts for your API key (input is hidden), verifies it, and saves it to
`~/.vehicles/credentials.json`. Every later command — and the MCP server — reuses it.

## Commands

| Command                 | Description                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `vehicles login`        | Store an API key. `--api-key <key>` sets it non-interactively; `--base-url <url>` targets a non-default origin. |
| `vehicles logout`       | Remove the stored key.                                                                                          |
| `vehicles whoami`       | Show the active key (masked), where it came from, and whether it still authenticates.                           |
| `vehicles decode <VIN>` | Decode a VIN into canonical vehicle identity fields (`GET /v1/vehicles/vin/{vin}`).                             |
| `vehicles --help`       | Full usage.                                                                                                     |
| `vehicles --version`    | Print the CLI version.                                                                                          |

## Authentication

The CLI resolves credentials in this order:

1. **`VEHICLES_API_KEY`** environment variable — always wins, so CI and servers never depend on an
   interactive login. Pair with `VEHICLES_API_BASE_URL` to target a non-default origin.
2. **`vehicles login`** — the stored key in `~/.vehicles/credentials.json`.

The credential file is written with `0600` permissions inside a `0700` directory, holds only your key
(and a base URL if you logged in against a custom origin), and is removed by `vehicles logout`. The
key is sent only to the API as an `Authorization: Bearer` header and is never printed in full.

## Use with the MCP server

The [vehicles.dev MCP server](https://vehicles.dev/mcp) reads `~/.vehicles/credentials.json` too, so a
single `vehicles login` authenticates it — no `"env": { "VEHICLES_API_KEY": ... }` block needed in
your MCP client config.

## Development

```bash
pnpm install
pnpm check   # format:check + typecheck + build + test
```

## Links

- Docs: <https://vehicles.dev/docs>
- Dashboard (API keys): <https://vehicles.dev/dashboard>
- TypeScript SDK: <https://github.com/vehicles-dev/typescript-sdk>
- Python SDK: <https://github.com/vehicles-dev/python-sdk>

## License

MIT © Vehicles.dev
