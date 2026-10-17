# Post-meeting owner capture

## Setup and capability check

Use a supported Granola Personal API account/key with transcript access, or an
explicitly supplied private cache with known coverage. Inject `GRANOLA_API_KEY`
through the user's environment/secret manager, never command arguments. Install
Node 22+ and a stable Standup checkout, then run:

```sh
node /path/to/standup/bin/granola-standup.js help
node /path/to/standup/scripts/install-granola-skill.mjs
# Optional second harness target:
node /path/to/standup/scripts/install-granola-skill.mjs ~/.claude/skills/granola-standup
```

The default installer target is `~/.codex/skills/granola-standup`; existing unrelated
skills are preserved. Keep the checkout: symlinks, CLI and references must resolve
to the intended revision. Verify both installed entrypoints and CLI help after updates.

Configure an authenticated writable **private** app through `STANDUP_URL` and
`STANDUP_TOKEN`, or existing gateway authentication with `STANDUP_AUTH=identity`.
The latter selects an existing authenticated transport, never identity spoofing.
Read `/api/config` and verify private/write capability before sending source content.
Use fictional canaries to establish owner access, non-owner denial, CSRF protection
and demo isolation before the first real import. Keep browser credentials server-side.

Missing key/access: explain the missing Granola prerequisite and how to configure
supported access. Missing/processing transcript: retain the candidate privately and
report that capture awaits publication/access. Neither state justifies inventing
updates or switching silently to a morning interview.

## Find the latest relevant meeting

Resolve intended owner/aliases, client/project, timezone and a bounded recent date
window from the request and configured profile. Ask only when needed to distinguish
plausible contexts. Read private existing import records to compare source IDs and
authoritative revisions. Follow all discovery pages and consider untitled notes;
title, time and attendee hints never establish a match. The CLI's underlying API
inventory can cover more than the date window; inspect its coverage/failures rather
than claiming it fetched only recent notes. Avoid repeated wide scans and reuse a
known private cache when appropriate, explicitly reporting its age/coverage.

Use the discover/review-template commands in [cli.md](cli.md), storing output in a
private directory. Review transcripts to find the latest relevant source revision
not yet imported. If unchanged/already present, report that outcome; do not create
a new record by altering revision, context or excerpt formatting. If no new recording
is available, say so with the checked window. If multiple plausible meetings cannot
be distinguished by evidence, retain them and ask a precise meeting/time/context
question before importing. Do not choose merely the newest title.

## Review the owner's view

Read the complete available transcript, not only the generated summary. Establish
owner attribution from evidence and configured identity; `microphone`/`speaker`
labels alone do not universally identify an owner or individual other speakers.
Keep uncertain attribution explicit. Preview privately:

- Owner's completed progress, separate from next actions.
- Explicit actions and stated priorities for the meeting's local date; historical
  “today” stays on that meeting date, never becomes the current day's plan.
- Blockers/dependencies: what the owner awaits and what others need from them.
- Decisions affecting the owner, distinguished from proposals and open questions.

Every derived claim needs an exact quote and source field. Preserve relevant team
context, keep unrelated round-robin updates in the full meeting, and never assign
someone else's work to the owner. No explicit today action means “no explicit today
action recorded,” not a fabricated plan. A missing owner profile or insufficient
attribution means a review-needed view, even if the meeting itself qualifies.

### Optional action dates

Consult the installed app’s `docs/personalization.md` for capability support.
Version 1 accepts optional `actionDate: "YYYY-MM-DD"` only for `kind: "action"`.
Use a calendar-valid date only when the exact source quotes support it; resolve
meeting-day “today” using the original meeting date and timezone, never the
import/review date. Omit unsupported timing rather than guessing.

Only `certainty: "explicit"` plus a date equal to the reader’s local calendar day
qualifies for today’s group. Historical, undated and ambiguous actions remain
separate, even if a historical source says “today.” Keep actually stated priorities
in the evidence-backed claim text; do not manufacture urgency or owner attribution.
The API validates calendar dates and quotes; the reviewer must validate meaning.

Existing undated or edited overlays remain unchanged. This additive optional field
requires no migration, source edits or reimport. Save dates only in a newly reviewed
view or explicitly requested refresh, preserving user edits. If the installed app
does not support the field, omit it and report dated rendering as pending the
compatible app; do not assume a pending app candidate is already deployed.

## Import and save separately

Run the reviewed import dry-run, inspect counts/failures, then `--apply` for the
authorized clear match. Retry identically and verify `alreadyPresent`, unchanged
record count and preserved originals. Compare pre/post existing source IDs,
revisions and source-field digests privately; a new match adds only its expected
entry. Preserve Granola originals, complete local candidates, summary/transcript
separation, labeled excerpt provenance and authoritative source URL.

An unchanged-source retry returns the existing personal view too: preserve user edits,
never regenerate or replace that view automatically. For an explicitly requested
refresh, reconcile the current edited claims with reviewed evidence before saving;
resolve actual conflicting intent with the user.

The CLI imports source evidence with empty progress/next; it does **not** create an
owner overlay. Read the installed app's maintained `docs/personalization.md` and
current API contract before saving one. Read profile, entry and existing overlay,
then PUT reviewed claims to `/api/entries/:id/personalization` using the current
profile/entry/source and overlay revisions. Quotes must be exact substrings of the
stored source; for excerpts include the needed reviewed evidence or leave the claim
pending. Use supported date fields only; do not invent schema for today's actions.
On conflict, re-read and review. Verify readback, unchanged original source and import
identity, and that the view remains editable. If unsupported/unavailable, report
“source imported; personal view pending” and retain the private preview; do not
rewrite originals or reimport to simulate a view.

Real-data verification belongs on the user's authorized private executor. Share only
counts, date window, exact skill/CLI/app versions and safe auth/source-preservation
status. Never copy real meetings into generic fixtures, pull requests, screenshots
or shared work tracking. No scheduled synchronization or unapproved provider calls.
