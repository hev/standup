# Standup

**Different teams. One place to pick up the thread.**

Standup is a small, MIT-licensed app for people who attend multiple standups.
Read a timeline across clients and projects, capture progress and next steps,
track recurring blockers, and search a ticket or something you remember.
Multiple meetings on the same day are independent records.

[Explore the fictional demo](https://standup.hevlayer.com) ·
[Workflow](docs/workflow.md) · [API](docs/api.md) ·
[Architecture](docs/architecture.md) · [Portable skill](skill/SKILL.md)

The public demo is read-only and contains synthetic data. Private capture uses
an owner token and a separate namespace. No private data migration is included.

## Run a private instance

Requires Node.js 22+, and a Layer gateway backed by Turbopuffer supporting native
embeddings (`qwen/qwen3-embedding-4b`, 1024 dimensions), conditional upserts,
exact fetch and `/search`. This is the tested backend. Direct Turbopuffer mode
and other stores/models are not claimed to be equivalent.

```sh
git clone https://github.com/hev/standup.git
cd standup
npm ci
cp .env.example .env
# Edit .env: Layer URL/key, three distinct namespaces and a random owner token.
npm test
npm run build
npm start
# Open http://127.0.0.1:8787 and enter your owner token.
```

Initialize a **new private namespace** once, before first capture:

```sh
node --env-file=.env scripts/init.mjs
```

Initialization adds the schema with a single application metadata document.
It refuses an existing namespace; never reset a namespace to repair setup.
Public demo seeding is a separate, explicit operation using fictional fixtures:

```sh
node --env-file=.env scripts/seed.mjs
```

See [deployment](docs/deployment.md) for Cloudflare and rollback. HTTPS is
required for remote private use. Server-side credentials never enter the
browser. A single owner token grants access to that owner's entire instance;
this version does not implement team accounts or partial context sharing.

## CLI and skill

```sh
export STANDUP_URL=https://your-private-instance.example
# Supply STANDUP_TOKEN through your secret manager; do not place it in a URL.
node scripts/cli.mjs list
node scripts/cli.mjs search HBR-142
node scripts/cli.mjs create my-standup.json
node scripts/cli.mjs get RETURNED_ID
node scripts/cli.mjs edit RETURNED_ID edited-standup-with-revision.json
```

[The portable skill](skill/SKILL.md) uses this same API and works with any agent
harness. If unconfigured, it prepares an unsaved draft without sending data.
Time/billing remains with the user's existing workflow.

## Optional call notes

Manual paste always works. A configured server adapter can provide recent calls
and a selected call, following [the adapter contract](docs/api.md#optional-call-adapter).
This repository supplies a deterministic fictional adapter for acceptance; it
does not claim a native Granola account integration or fetch personal notes.
Preview and edit before importing into an explicit client/project context.
Summary and transcript stay separate. Source ID + revision + context prevents
retry duplication; proposals are never extracted as decisions or commitments.

## Historical archive importer

Run on the machine that already owns the files. Originals remain untouched.

```sh
node scripts/import-archive.mjs --dir fixtures/archive --client Fictional --project Demo
# Default: dry run, reports invalid records. Exit 2 means some records are invalid.
# After reviewing, add --write to import using STANDUP_URL and STANDUP_TOKEN.
```

Supports standup/day/wrapup Markdown with an ISO date in path or content.
Preserves complete source text, relative source path and content revision;
recognizes Progress/Done/Yesterday and Next/Today/Planning headings. It reports
missing/invalid dates and empty files, skips symlinks, and preserves unsupported
sections as notes. Repeating an unchanged import returns existing IDs. A changed
archive creates a new source revision, preserving the earlier record. Billing
sections remain source evidence; this importer does not create billing records.

## Validation

`npm test && npm run build` runs deterministic guards and builds the Worker.
`npm run test:integration` requires real Layer credentials and a fresh synthetic
`UAT_NAMESPACE` beginning `standup-uat-`. It tests persistence, concurrent edits,
ticket and paraphrase search, filters, blockers, call drafts/idempotency,
authorization, CLI and importer. It deletes only its own test namespace afterward.

```sh
npx playwright install chromium
UAT_COMMIT=$(git rev-parse HEAD) UAT_DIR=/tmp/standup-preview scripts/uat preview
UAT_COMMIT=$(git rev-parse HEAD) UAT_DIR=/tmp/standup-live scripts/uat live https://standup.hevlayer.com
```

Preview uses a real Layer namespace and a local expiring authenticated sandbox;
it records desktop/390px screenshots, video and a trace. Live independently checks
the exact deployed version and public read-only behavior. Missing credentials,
skipped acceptance or version mismatch fails. Evidence belongs outside the repo.

## Current scope

Timeline/export/facets are bounded to 10,000 filtered records; narrow filters
when exceeded. Search returns up to 30 hybrid matches, with native embeddings
and no reranker dependency. Semantic similarity is a useful lead, not proof.
Granola requires a separately configured adapter; there is no background sync.
No billing, team administration, streaks or performance scoring.

The tested native profile uses 1024 dimensions. Non-default 2560-dimensional
profiles have a known metadata readback/search mismatch on the current gateway;
see [the compatibility tracker](https://github.com/hev/standup/issues/2). The
original fictional index is preserved for diagnosis. This app uses real native
search and does not supply alternate vectors or periodically rewrite schemas.
An internal preview can set `SEARCH_DISABLED=1` to clearly disable unavailable
search while retaining the readable timeline; this is not full release acceptance.
