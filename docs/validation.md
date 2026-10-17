# Executable acceptance contract

The application must ship an executable `scripts/uat` supporting `preview`
and `live URL`. Each ends with a JSON line containing boolean `passed`, exact
`version` and named `checks`. `UAT_COMMIT` is the required exact candidate and
`UAT_DIR` is the evidence directory. Missing tests, skipped acceptance or a
version mismatch fail; a scaffold cannot return a product pass.

`preview` runs from a clean exact checkout, installs locked dependencies, builds,
runs deterministic tests and real Layer integration in an isolated fictional
namespace, then drives Chromium on desktop and at 390px. Save screenshots and a
recording/trace with expected and actual behavior. Close owned browsers/servers
on success and failure. Do not use a personal browser profile.

Verify two same-day entries in different contexts survive refresh; stale edit
conflicts; ticket and paraphrase search with source links; combined context/date
filters and shareable URLs; stable recurring blocker history and resolution;
mocked Granola preview and repeated import without duplicates; optional integration
failure and editable proposal drafts; unauthorized detail/search/facet/export/write;
no browser secrets; CLI/skill API parity; importer dry run and repeat import using
fictional archives. Never fetch personal Granola notes for demo acceptance.

`live URL` independently exercises the public synthetic read-only demo, desktop
and mobile, and checks its version endpoint against `UAT_COMMIT`. Interactive
capture is permitted only in an explicitly expiring isolated sandbox. A validator
also checks clean-clone self-host setup, not just an already prepared developer
checkout. Deployment credentials and validation host paths remain outside this
repository. Product candidate acceptance is separate from bootstrap CI.

Owner-focus acceptance extends the existing exact-candidate Mini preview: configure a fictional profile; review a mixed multi-speaker meeting; save actions and relevant dependencies with exact source quotes; label speaker ambiguity and a proposed date; verify unrelated round-robin updates remain in the full meeting. Refresh, inspect original CRLF/whitespace and unchanged note revision, then read the long original at 390px. `scripts/uat preview` records these checks using synthetic content. The real Layer suite separately checks overlay persistence and conflicts. Deployment owners must also confirm unchanged private note/source IDs, count, auth and search without publishing real bodies. Mascot selection and actual-size visual inspection are recorded with the asset provenance.

Today acceptance uses only synthetic notes: an explicit action dated the reader's
local day, a historical dated plan, an uncertain speaker and a proposed date.
Confirm only the explicit current action leads, editor round-trip retains its
date, and the original note remains identical. Legacy undated/fresh meetings do
not infer a today action (deterministic checks). Preview captures today views and
mascot/credit at desktop and 390px in light/dark. Verify light mascot backing,
selectable Layer credit, focus, block animation and static reduced-motion state.
Independent Mini acceptance additionally inspects these rendered surfaces and
retains its own evidence before scoped internal deployment; no public release.
