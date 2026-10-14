# Standup

Standup is an open-source app for people who attend multiple standups.
Capture progress, next steps, blockers and notes in a client/project context;
read a timeline and search across the contexts you are allowed to access.
Multiple entries on the same date are separate records with stable IDs.

This repository currently contains delivery prerequisites. The app, demo and
integration tests are still being built; there is no usable hosted app yet.

## Development

Requires Node.js 22 or later. `npm ci && npm test` verifies the bootstrap.
The intended small web stack is a Cloudflare Worker plus static browser assets,
following [the Layer search demo](https://github.com/hev/hybrid-text-fusion-demo).
Backend credentials belong only in server-side environment/secrets.
See [architecture](docs/architecture.md) and [validation](docs/validation.md).

## Data and deployment

Canonical structured notes live in Layer backed by Turbopuffer. Demo data must
be fictional. A public read-only demo, private instance and expiring capture
sandboxes must use separate namespaces. No localStorage or Markdown database.
No real meeting notes, customer facts or credentials belong in this repository.

Deployment configuration and executable application checks will land with the
application. Account identities, host configuration and operator credentials
are maintained outside this public repository. Publishing the app requires a
validated exact commit, real backend checks and a desktop/mobile browser flow.

## License

MIT; see [LICENSE](LICENSE).
