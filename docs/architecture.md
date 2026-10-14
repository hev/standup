# Source and deployment boundary

This repository owns the web UI, API, CLI, portable skill, synthetic seed,
fictional archive importer, app tests and reproducible self-host setup.
It must not contain estate provisioning, host identities or personal notes.

The selected primary backend is the Layer HTTPS gateway backed by Turbopuffer.
Use the native write endpoint `POST /v2/namespaces/{namespace}`, exact fetch
`GET /v2/namespaces/{namespace}/documents/{id}`, and query
`POST /v2/namespaces/{namespace}/query`. Layer-native
`POST /v2/namespaces/{namespace}/search` provides embedded hybrid search and
reranking when the namespace has a supported embedding schema. Verify deployed
capabilities and the chosen model against an isolated synthetic namespace.
`HybridText` alone is lexical and does not prove paraphrase search.

The current gateway schema describes conditional writes and affected ID lists.
Use a revision attribute and conditional patch/upsert; do not claim conflict
safety based on a fetch followed by an unconditional write. Prove rejected stale
writes with real backend tests. Exact fetch may involve gateway cache state;
verify conditional writes/readback explicitly. If a required guarantee is absent,
record a minimal reproduction before adding a transactional service.

API reference: [Layer documentation](https://hevlayer.com/docs), inspected
2026-10-14. Verify your installed gateway version before using native extensions.
Frontend/deployment reference: `hev/hybrid-text-fusion-demo` at
`d8593a2fd05ce21fc283486d0299bb81c9d317bd`: Worker/static assets, server-side proxy,
custom domain and backend key stored as a Worker secret.
A portable direct Turbopuffer mode is not yet tested or promised.

## Configuration contract

The application will document its exact environment names. Reserve
`LAYER_GATEWAY_URL`, `LAYER_API_KEY`, and separate namespace configuration for
public demo, private notes and an expiring test sandbox. Authenticate and
check context access before search, facets, detail, export and every mutation.
Granola remains optional and server-side; manual import works without it.

The application owns the deploy config and version endpoint. Deployers use their
existing Cloudflare access, build the exact reviewed commit, keep the previous
version for rollback and verify that the live version matches. Never deploy a
scaffold as evidence of a working product.
