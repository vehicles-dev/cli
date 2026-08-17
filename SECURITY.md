# Security policy

## Supported versions

Security fixes are released for the latest published version of `vehicles-dev-cli`.

## Reporting a vulnerability

Please do not open a public GitHub issue for a suspected vulnerability. Email
<support@vehicles.dev> with `SECURITY` in the subject and include:

- the affected CLI version;
- a minimal reproduction or proof of concept;
- the impact you observed; and
- any suggested mitigation.

Do not include a live Vehicles.dev API key. If a credential may have been exposed, revoke it in the
Vehicles.dev dashboard immediately and create a replacement.

We will acknowledge a report as soon as practical and coordinate remediation and disclosure with the
reporter.

## Where the CLI stores your key

`vehicles login` writes your API key to `~/.vehicles/credentials.json` with `0600` permissions inside
a `0700` directory, so other users on the machine cannot read it. `vehicles logout` removes it. The
key is sent only to the configured API origin (`https://api.vehicles.dev` by default) as a
`Authorization: Bearer` header, and is never logged or printed in full. On shared or CI machines,
prefer the `VEHICLES_API_KEY` environment variable over an interactive login.
