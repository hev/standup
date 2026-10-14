# Historical Granola standups

Run the optional Node 22 CLI on your laptop or private server. No Granola account
is required for the app. No browser integration or periodic ingestion is enabled.
The existing app API is unchanged. Environment credentials stay in the process;
the CLI never prints remote bodies, candidates, tokens or review text.

```sh
node bin/granola-standup.js help
node bin/granola-standup.js discover --from 2026-09-01T00:00:00Z --to 2026-10-15T00:00:00Z --client 'Fictional Harbor' --out /private/scan.json
node bin/granola-standup.js review-template --candidates /private/scan.json --out /private/review.json
# Review the evidence locally using skills/granola-standup/SKILL.md.
node bin/granola-standup.js import --candidates /private/scan.json --review /private/review.json --out /private/report.json
# With STANDUP_URL and STANDUP_TOKEN in the environment, add --apply to import.
```

Set `GRANOLA_API_KEY` through your environment/secret manager for discovery.
Never put credentials on command lines or in a public build. Candidate and review
files contain private content and must stay outside the repository. Files are
written atomically with mode 0600. Choose a private local directory.

Discovery traverses all list pages, then every transcript page for each note.
Granola creation-date filters describe note creation rather than meeting time;
therefore the CLI lists the accessible account history and applies the requested
half-open date range to transcript start time, falling back to scheduled time
with explicit review required. Unknown time is a review candidate. Client context
is an intended scope, **not** a keyword filter; the reviewer must establish it
from content. Titles and content keywords are hints only and never accept or
exclude a standup. This favors completeness over a cheap title-only scan.

Every candidate remains `needs_review` until a local human/agent reads evidence.
Mixed standup/deep discussion qualifies when progress/next and blockers/round-robin
are substantiated. Missing transcripts, inaccessible/processing notes, failed
pages, rate limits, and a 1,000-page limit are incomplete scans, not zero meetings.
Requests have 30-second timeouts and up to three bounded retries on network,
429 and 5xx errors. Retry-After beyond 60 seconds stops for a later resume.
Use identical discover arguments plus `--resume` after a failure. The checkpoint
keeps the failed page cursor; previously successful records are skipped. A fresh
output file performs a new scan and detects changed revisions. Checkpoints are
local resumability aids, not an authoritative archive or snapshot of changing API
results. After interruption, resuming imports is safe through server idempotency.

Review JSON has `format: granola-review-v1` and `reviews`. Each item includes
`id`, `evidenceHash`, `decision` (`accepted`, `ambiguous`, `excluded`), `reason`,
`client`, `projects`, `contextReason`, and `evidence:[{turn,quote,signal}]`.
Signals are `progress`, `next`, `blockers`, `round_robin`, `context`. Accepted
records need an update signal and blockers or round-robin evidence. Quotes must
occur verbatim in the indexed transcript turn. This validates references, not
the semantic judgment: the skill's evidence review is the classification step.
For scheduled/unknown time supply `timeReason` and, if needed, `meetingTime` with
an offset. The source time retains the offset; the entry date follows that local
date. No timezone is invented when the source gives only UTC.

Set `relatedSources` to explicitly reviewed archive/source references for likely
Markdown duplicates; they are retained in provenance, never silently collapsed.
Distinct source IDs on the same date remain distinct. Source revisions use authoritative API `updated_at` with a canonical hash fallback; a changed revision creates a separate entry
under the existing app policy, preserving the old one. An identical retry returns
the original entry, preserving user edits. The report separates scanned,
candidates, qualifying, imported, alreadyPresent, ambiguous, excluded and failures.
Discovery failures must be resolved before any import. Import stops on its first
uncertain write; replay is safe because the app creates deterministic IDs.

Imports preserve summary and transcript separately and keep progress/next empty:
proposals never become decisions or the owner's commitments. Provenance includes
classification reasons, evidence references and source update time. App v1 limits
each source field to 12,000 characters; larger sources fail before any write.
Do not silently truncate. Keep the original private candidate file. A reviewer may
explicitly set `transcriptTurns:[0,1,...]` (original turn indexes) and `excerptReason`
to import just the reviewed standup portion; every cited evidence turn must be
included. `summaryExcerpt` may select an exact contiguous source summary passage
with the same explicit reason. The imported provenance labels excerpts, records
the full evidence hash and original turn count, and states that originals remain
in the private local candidate file. This preserves originals locally while the
app stores a clearly labeled excerpt. Without explicit excerpt selection,
oversized imports fail before writing. Extending the app for full long-transcript
storage is separate work.

`--apply` authenticates `/api/config` before sending notes and refuses demo,
sandbox, read-only and unauthenticated destinations. Use the private deployment's
auth and namespace isolation acceptance before loading real data. This is a
client guard in addition to server enforcement, not a substitute for it.

## Supported API contract

Verified against official Granola docs on 2026-10-14:

- [API and key access](https://docs.granola.ai/help-center/sharing/integrations/granola-api)
- [List Notes](https://docs.granola.ai/api-reference/list-notes): Bearer auth,
  `https://public-api.granola.ai/v1/notes`, `page_size` up to 30,
  `notes`, `hasMore`, `cursor`.
- [Get Note](https://docs.granola.ai/api-reference/get-note): metadata,
  nullable title, summaries, calendar and source URL.
- [Get Transcript](https://docs.granola.ai/api-reference/get-transcript):
  `/notes/{id}/transcript`, up to 100 turns/page, `transcript`, `hasMore`, `cursor`.

The connector uses the separate paginated transcript endpoint even for small
notes, avoiding the inline `TRANSCRIPT_TOO_LARGE` failure. It uses supported
Personal API keys, never reverse-engineered desktop-session endpoints. Account
entitlement and historical coverage are controlled by Granola. Synthetic HTTP
contract fixtures prove client behavior; no private account has been fetched or
live entitlement claimed by these tests.

## Install the portable skill

Keep this checkout at a stable path, then run
`node scripts/install-granola-skill.mjs` to link the maintained skill into
`~/.codex/skills/granola-standup`. An optional argument chooses another harness's
skill directory, for example `~/.claude/skills/granola-standup`. Existing unrelated
skills are preserved. The link keeps the skill's CLI and reference documentation
at the same code revision; moving or removing the checkout breaks the link.
Use the absolute checkout path printed by the installer when invoking the CLI.
For an existing authenticated identity gateway, set `STANDUP_AUTH=identity`
instead of a client token. This explicitly selects gateway authentication;
`/api/config` must still succeed and report writable private mode before any
meeting is submitted. The CLI does not bypass authentication or manufacture
identity headers.

The generic workflow can also be referenced by a consolidated Standup skill in
an independently maintained skills repository; no account-specific facts are
needed in that integration.

Synthetic compatibility validation can additionally run against an exact app
checkout (no server credentials):
`STANDUP_APP_CHECKOUT=/path/to/standup-app node --test test/granola-app-contract.mjs`.
It uses the actual app handler and a synthetic store to test the unchanged API;
it does not claim a live Granola account or real backend storage validation.

## Reuse a local cache without refetching

`discover --cache CACHE.json --from ISO --to ISO --client CLIENT --out LOCAL.json`
uses no Granola credentials or network. Adapt existing local per-note results to:

```json
{
  "format":"granola-cache-v1",
  "coverage":{"complete":true,"description":"All notes in the selected local inventory; not a fresh API scan"},
  "notes":[{
    "id":"not_synthetic00001","title":null,
    "updated_at":"2026-10-14T18:00:00Z",
    "web_url":"https://notes.granola.ai/d/fictional",
    "summary_markdown":"Full original summary, whitespace preserved",
    "calendar_event":{"scheduled_start_time":"2026-10-14T09:00:00Z"},
    "transcript":[{"text":"Fictional team update","start_time":"2026-10-14T09:00:00Z","speaker":{"attribution":"me"}}]
  }]
}
```

Keep every inventory note, even null/misleading titles and summary-only records.
Map API fields exactly, without trimming original summaries. Join cached transcript
results by source ID. Missing transcripts use `null`; partial cached transcripts
must set `transcript_complete:false`. Neither is claimed to be a full original.
The coverage description names the local snapshot's bounds; `complete:true` means
the supplied snapshot inventory is complete, not that Granola was freshly scanned.
Changing the cache invalidates resumability; generate a fresh scan and review.
Existing accepted/excluded/held judgments can be transcribed into review JSON, but
accepted judgments still need indexed transcript quotes, context reasons and
explicit excerpt indexes/reason. Do not upload cache bodies to shared logs.

Source revision is now the exact authoritative API `updated_at` string, matching
existing API imports. It is never reformatted or replaced by an excerpt hash.
When `updated_at` is absent, a canonical evidence SHA256 is the fallback. Separate
`fullEvidenceHash` hashes all available raw note evidence (including a full cached
transcript when supplied), while `evidenceHash` binds the normalized review input.
These are evidence hashes, not claims of source completeness. `revisionBasis` and
excerpt provenance describe the distinction. Optional review
`importedSourceRevision` must equal both `sourceUpdatedAt` and source revision;
arbitrary overrides fail. Rescanning unchanged cached notes with the same context
therefore returns already-present entries created using `updated_at`, including
imports whose transcript excerpt formatting differs. A new authoritative revision
preserves the old entry. Old hash-revision candidate/review files must be rebuilt
from their original raw cache; do not silently reinterpret old review hashes.

For standalone transfer, archive the exact commit without app deployment files:

```sh
git archive --format=tar.gz --output=granola-cli.tar.gz EXACT_SHA package.json LICENSE bin/granola-standup.js src/granola skills/granola-standup scripts/install-granola-skill.mjs docs/granola.md
mkdir granola-cli
tar -xzf granola-cli.tar.gz -C granola-cli
node granola-cli/bin/granola-standup.js help
```

No dependency installation is needed. The CLI is backward compatible with the
existing private `/api/config` and `/api/import`; it requires no server rollout.
