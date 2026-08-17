# Changelog

All notable changes to `@vehicles-dev/cli` are documented here. This project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.1.0

Initial release.

- `vehicles login` — store an API key in `~/.vehicles/credentials.json` (verified against the API,
  written with `0600` permissions). The vehicles.dev MCP server reads the same file, so a single
  login authenticates both.
- `vehicles logout` — remove the stored key.
- `vehicles whoami` — show the active key (masked), its source, and whether it still authenticates.
- `vehicles decode <VIN>` — decode a VIN into canonical vehicle identity fields.
- `VEHICLES_API_KEY` (and `VEHICLES_API_BASE_URL`) environment variables override the stored login.
