---
name: standup
description: Capture, update and search standups across explicitly chosen client/project contexts using the Standup API or CLI. Optional call preview and manual import preserve source evidence.
---

# Standup

The default invocation is **after the user's real standup**: capture their updates
from Granola into their private Standup instance. Granola access and actual
transcript evidence are prerequisites. Use the companion
[Granola discovery/review/import workflow](../skills/granola-standup/SKILL.md).
Discover the latest not-yet-imported relevant meeting within a bounded date
window, including untitled notes and every results/transcript page. Compare
source IDs and authoritative revisions against existing imports. Review actual
transcript evidence; titles, times and summary hints alone do not classify a
standup or establish owner attribution. Keep ambiguous candidates for review.

Extract only the owner's progress, explicit actions, blockers/dependencies and
stated priorities, preserving proposals and uncertain speaker attribution. Preview,
dry-run and import the reviewed authorized scope idempotently into the private
app; repeat to verify no duplicates. Preserve full originals and local review
artifacts. Save the separate editable personal view using the
[owner contract](../docs/personalization.md), with exact source quotes. Date an
action only if the source supports it: meeting-day “today” means the meeting date.
Never promote old plans to today's actions. Missing Granola access/transcript or
uncertain ownership needs an actionable honest explanation, not invented updates.
No scheduled sync or provider bulk calls.

**Morning preparation** is an explicit alternate mode. When requested, review
prior evidence and ask only for missing context; do not invent commitments.
Manual capture remains available when explicitly requested. Multiple entries on
the same date stay independent; no mandatory morning/evening ceremony or scoring.

## Setup and safe fallback

The user configures `STANDUP_URL` and `STANDUP_TOKEN` outside this skill.
Use the CLI at `scripts/cli.mjs` from the user's Standup installation, or the
same documented HTTP API. Never print tokens or place them in URLs/prompts.
If the endpoint/token is missing, explain which private setup is missing and
that nothing has been saved. Only prepare an unsaved draft if requested. Never silently switch to a public demo,
create a new account, transfer private notes, or claim persistence.

## Capture and update

Create a JSON file with `title`, `date` (ISO), `client`, `projects` (array),
`progress`, `next`, `notes`, and `blockerIds` (array). Run `standup create FILE`
(or `node scripts/cli.mjs create FILE`). Read the returned ID and revision.
Use `standup get ID` before an edit, preserve source provenance, include the
current `revision` in the replacement JSON and run `standup edit ID FILE`.
On 409 preserve the user's draft, fetch the latest entry and reconcile with
the user; do not overwrite a competing edit.

Use `standup blockers` to link a recurring blocker by stable ID; create a new
one with `POST /api/blockers` only when needed. Resolving requires evidence and
current revision: `standup resolve ID REVISION EVIDENCE`. Retain history.

## Search

`standup search HBR-142` or `standup search waiting for vendor access` reads
across the single owner's authorized contexts. Use `GET /api/search` filters
`client`, `project`, `from`, `to`, `type` to narrow explicitly. Cite returned
entry IDs and original sources. Do not treat an approximate match as proof or
share cross-client text publicly. Shareable app links carry filters and entry
ID; they omit search text and still require access for a private instance.

## Optional call notes

When explicitly requested, list `GET /api/calls`, select one and fetch
`GET /api/calls/ID`; never bulk sync. Otherwise manual paste works.
`standup preview FILE` accepts `{source:{id,revision,type,url,time,summary,transcript}}`.
Preview yields an editable draft. Choose client/projects and edit before
`standup import FILE`. Source ID + revision + context makes retries idempotent.
Keep summary distinct from transcript. Speaker attribution can be ambiguous.
Proposals remain proposals; never infer the owner's commitments from another
speaker or promote a suggestion into a decision. A call can inform different
contexts only through explicit attribution and separate imports.

## Historical archives

Run `scripts/import-archive.mjs --dir PATH --client CLIENT --project PROJECT`
on the user's own machine. Default is dry run with invalid-record reporting.
Only use `--write` when the user requests importing those files. Preserve the
original files, source path and content revision. Do not migrate private data
as part of a demo. Time/billing and wrapup responsibilities stay with their
existing workflow; this skill makes no billing writes.
