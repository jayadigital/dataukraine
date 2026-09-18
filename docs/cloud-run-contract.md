# Cloud Run data-plane contract

The browser package and the data plane are separate concerns. Cloudflare
serves this repository's shell and forwards bounded reads to the Cloud Run
service configured as `API_ORIGIN`. The service reads the current immutable
release from GCS and never exposes the GCS bucket directly.

## Required read surface

For every published corner, the data plane serves the following object paths
under `/v1/{corner}/data/`:

```text
dataroom/manifest.json
dataroom/{dataset}/summary.json
dataroom/{dataset}/schema.json
dataroom/{dataset}/rows or chunk files
reports/manifest.json
reports/{report}.json
reports/{report}.md
```

The universal `ukraine` service additionally serves `/v1/ukraine` routes for
corner discovery, dataset search, bounded series, frames, forecasts, and the
latest report. The Cloudflare Worker maps these routes to the public
`/api/v1/ukraine` contract described in [`api.md`](api.md).

## GCS release layout

```text
gs://<bucket>/<corner>/releases/<release-id>/data/...
gs://<bucket>/<corner>/current.json
```

`current.json` is a small pointer. A release is immutable and is promoted only
after required manifests, JSON, CSV, and Markdown files pass validation. The
Cloud Run process should keep the current pointer read-only for public
requests, use bounded object reads, and return cache headers suitable for
Cloudflare.

## Security boundary

- GCS remains private.
- Cloud Run exposes public `GET` reads only.
- Refresh, upload, promotion, and rollback routes require an operator token.
- Credentials are environment variables or managed service identity, never
  repository files.
- The Cloudflare worker forwards query strings but does not accept public write
  methods for the universal API.

This repository documents and consumes the contract; deployment credentials and
the production service account stay in the separate operational environment.
