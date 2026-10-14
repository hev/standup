# Standup API v1

All routes use JSON. Errors are `{error:message}`. Private instances require
`Authorization: Bearer OWNER_TOKEN` for CLI/API calls. Browser sign-in uses
`POST /api/session` with `{token}` and an HttpOnly, SameSite=Strict cookie;
browser writes must have the same Origin. Remote instances must use HTTPS.
The owner can search every context in their instance. There is no multi-user ACL.

Public demo routes read only the synthetic demo namespace. All mutations and
call-adapter reads are denied. `/api/version` is public in every mode and returns
`{version:exactCommit}` without configuration or secrets.

| Method / path | Request / response |
| --- | --- |
| GET `/api/config` | Mode, readOnly, optional-adapter availability, sandbox expiry |
| GET `/api/entries` | `{rows,cursor}`; 50 newest entries, cursor for next page |
| GET `/api/entries/ID` | `{entry}` with complete source and revision |
| POST `/api/entries` | Full note; returns `{entry}`, status 201 |
| PUT `/api/entries/ID` | Full note plus current `revision`; 409 on conflict |
| GET `/api/search?q=TEXT` | `{rows}` with match passage; filters apply to every leg |
| GET `/api/facets` | `{clients,projects}` across authorized notes |
| GET `/api/export` | `{format:"standup-v1",entries,blockers}` |
| GET `/api/blockers` | `{rows}` with stable IDs and history |
| POST `/api/blockers` | `{title,client,since,evidence}`; `{blocker}` |
| PUT `/api/blockers/ID` | `{revision,status:"open"|"resolved",evidence}`; history appended |
| GET `/api/calls` | Optional adapter `{calls}`; 503 if unconfigured |
| GET `/api/calls/ID` | Selected adapter `{call}`; 502 if unavailable |
| POST `/api/import/preview` | `{source}`; `{source,draft,warning}`; no persistence |
| POST `/api/import` | Full edited note with source; `{entry,duplicate?}` |

Filters: `client`, `project`, `from`, `to` (inclusive ISO dates), `type`
(`standup`, `call`, `planning`). Combine filters in the query string. Browser
filter URLs omit search text. Detail URLs carry an ID, and still require access.
A bounded timeline scan supports 10,000 filtered records; no silent truncation.

```json
{
  "title": "Checkout check-in",
  "date": "2026-10-14",
  "client": "Fictional Harbor",
  "projects": ["Checkout"],
  "type": "standup",
  "progress": "HBR-142 retry states are ready.",
  "next": "Review keyboard navigation.",
  "notes": "The provider access request remains open.",
  "blockerIds": []
}
```

An entry returns a generated stable `id`, revision 1, `kind:"note"`,
`createdAt` and `updatedAt`. Edits require the revision that was read. The
conditional upsert is enforced by the backend; a fetch followed by an
unconditional write is never used. Concurrent edits cannot both win.

`source` is optional on normal notes and required on imports:
`{id,revision,type,url,time,summary,transcript}`. HTTP(S) URLs only.
Import identity is a SHA-256-derived ID (224 bits, within backend ID limits)
over source type/ID/revision and explicitly attributed client/sorted projects.
An identical retry returns the original entry, including its edits; it does
not overwrite it. A new source revision preserves the previous entry.

The archive importer additionally uses `importKey` for conditional create-only
idempotency. This is an API-level key; canonical notes remain Layer documents.
Stable blockers are separate documents. Link their IDs into any explicitly
chosen entry; resolution preserves since date, evidence history and old links.

## Optional call adapter

Configure `GRANOLA_ADAPTER_URL` and `GRANOLA_API_KEY` server-side. The app sends
Bearer auth to this adapter, never to the browser. The adapter implements:

- `GET /calls` → `{calls:[{id,title,time}]}` (bounded recent list).
- `GET /calls/ID` → `{id,revision,type:"granola",url,time,summary,transcript}`.

If `GRANOLA_API_KEY` is set without an adapter URL, the server uses the Granola
Personal API: a bounded recent-note page and selected note transcript pages.
An adapter URL overrides this for another permitted integration or fixtures. No personal
notes are required. Call IDs in this version must match letters/digits/`_`/`-`.
An unavailable adapter leaves manual paste/preview usable. The draft has empty
progress/next; summary (or transcript if no summary) goes into editable notes.
No speaker's proposals are promoted into decisions or the owner's commitments.

Optional `provenance` objects (maximum 12,000 serialized characters) retain
import review/evidence-retention metadata separately from readable notes. A
source can also carry provenance such as scheduled versus transcript time.
