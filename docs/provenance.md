# Provenance and release trust

DataUkraine is a data delivery layer, not the authority for the underlying
statistics. Each adapter keeps the publisher identity and original source URL
with the normalized dataset.

## Required lineage

Every published dataset should carry:

- stable source and dataset identifiers;
- original publisher URL or API request;
- retrieval or release timestamp;
- coverage start and end;
- frequency, unit, multiplier, geography, and classification;
- observation status and quality flags;
- release hash or immutable release path where available.

The original source row is retained in local SQLite as `raw_json` when the
source contract permits it. The public release exposes bounded normalized
files, source references, and coverage notes so a reader can reproduce the
interpretation without downloading an entire warehouse.

## Release sequence

1. Build one source corner from a cached or fresh source response.
2. Run source-specific tests and coverage checks.
3. Run the global release audit.
4. Upload an immutable release to GCS.
5. Validate required manifests in Cloud Run.
6. Move the current pointer only after validation succeeds.
7. Publish the universal catalogue after its source releases are current.

The public UI never writes data. A failed or deferred source is represented in
the coverage report; it is not replaced with zeroes or silently omitted.
