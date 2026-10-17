# Owner-focused reading

Configure your name, aliases and relevant projects in **Your focus**. A meeting opens with your progress, explicit actions, dependencies and decisions affecting you. A separate editable view can be prepared by a trusted local workflow or edited in the app. No automatic provider calls occur. Without reviewed evidence, Standup says that the view needs review and offers the complete meeting.

Every claim retains an exact quote and its source field. Ambiguous attribution stays labeled; proposals must not become decisions, and another speaker's update must not become your commitment. Relevant team dependencies belong here; unrelated round-robin updates remain in the full meeting. Changing profile, note or source makes the prior view stale until reviewed again. Originals and import identity never change when a derived view is saved.

## Version 1 data contract

All endpoints inherit the instance authentication, CSRF and demo read-only rules. No private content belongs in public fixtures, logs or evidence.

- `GET /api/profile` returns `{profile}` (null if unconfigured).
- `PUT /api/profile` accepts `{revision: 0, name: "Morgan", aliases: ["Morgan", "M"], projects: ["Checkout"]}` for creation; updates use the returned revision. Returns `{profile}` including `version:1` and incremented `revision`.
- `GET /api/entries/:id/personalization` returns `{personalization}` (null if absent).
- `PUT /api/entries/:id/personalization` accepts `{revision:0, personalization:{version:1, profileRevision:1, entryRevision:1, sourceRevision:"source revision or empty string", claims:[{kind:"action", text:"Review the checkout proposal", certainty:"explicit", evidence:[{field:"source.summary", quote:"Morgan will review the checkout proposal."}]}], ambiguity:["The meeting proposes a launch date; no decision was recorded."]}}`. Updates use the overlay's returned revision, not the entry revision. Allowed kinds: `progress`, `action`, `dependency`, `decision`. Certainty: `explicit` or `ambiguous`. Evidence fields: `source.summary`, `source.transcript`, `progress`, `next`, `notes`. Quotes must be nonempty exact substrings of the existing field. Source IDs, authoritative revisions, original whitespace and entry counts remain unchanged. No new import.

The overlay is a separate Layer document (`kind:personalization`) keyed by existing entry ID; profile is `kind:profile`. Neither is a note or search result. Optimistic revisions prevent overwrites. Full originals are still available through the existing entry/export endpoints. Export includes overlays and profile separately for portability. The app never silently extracts commitments from aliases or speaker labels. The trusted reviewer is responsible for semantic attribution; exact-quote validation establishes traceability, not truth.

Refresh sequence: read profile and existing entries; inspect original evidence locally; prepare claims with explicit ambiguity; PUT only the separate personalization endpoint. On conflict, re-read and review. Verify the same note/source IDs and original bodies afterward. Do not reimport, rewrite sources or send private content to an unapproved provider.

## Visual treatment

Standup follows the published [hev mind brand](https://hevmind.com/brand): paper and warm paper surfaces, ink and muted reading text, a single burnt orange signal, 1px rules and corners at most 2px. JetBrains Mono carries headings, navigation and controls; Inter carries prose. The operator mascot is a separate raster signature with pixel rendering, never generated typography or a substitute logo.

## Today and historical meetings

The owner view leads with **Your actions today**, followed by other next actions,
dependencies, completed progress and decisions. Today is the reader's local
calendar date, displayed beside the meeting date. A historical meeting's “today”
means its own date; plans never roll forward automatically. Missing reviewed
claims, uncertain attribution and no explicit action today are honest states.

Version 1 claims now accept optional `actionDate: "YYYY-MM-DD"` on `kind: "action"`.
This additive field preserves existing clients and undated overlays. Only explicit
attribution plus a date equal to the reader's current day appears in today's group.
The editor and trusted workflow must verify that the existing exact source quotes
support the date: resolve meeting-day “today” using the original meeting date,
never the import/review date. If timing is not supported, omit the date. Keep
actually stated priorities in claim text with their supporting evidence; never
rank by invented urgency. Progress remains completed work, dependencies retain
whose work is awaited, and proposals/uncertain speakers never become commitments.
The API checks calendar validity and exact quotes; the reviewer owns semantic
attribution and date interpretation. Saving a view does not edit/import its source.

The lower-left selectable `hev_layer` wordmark links to `https://hevlayer.com`,
the canonical product domain used by the Layer repository's CE documentation.
Its orange full block is decorative and static with reduced motion. The approved
mascot PNG is unchanged and always backed by light paper, including dark mode.
