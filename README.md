# DataUkraine 0.1

DataUkraine is an open software reference implementation for a public,
source-backed data room about Ukraine. It turns official and licensed source
data into inspectable releases, stable graph contracts, read-only API
responses, and a responsive catalogue for researchers and stakeholders.

Live interface: <https://dataukraine.proto.fund>

Public API: <https://dataukraine.proto.fund/api/v1/ukraine>

OpenAPI: <https://dataukraine.proto.fund/api/v1/ukraine/openapi.json>

Widget examples: <https://dataukraine.proto.fund/developers/widgets>

## What this repository exposes

- React data-room interface with catalogue, dataset, graph, comparison, report,
  export, and embed views.
- Cloudflare Worker routing for the public shell, source corners, universal
  API, social metadata, and read-only data access.
- Source-specific ingestion/build scripts for NBU, State Statistics, Budget,
  OECD, World Bank, ILOSTAT, IMF, Eurostat, UN Comtrade, Trading Economics,
  industrial/RI data, World Steel, and OWID.
- Stable dataset and graph identifiers, bilingual metadata, unit/frequency
  fields, observation status, source links, coverage, and freshness contracts.
- Local SQLite data labs for schema inspection and bounded SQL exploration.
- Cross-source comparison logic that refuses to imply comparability when units,
  frequencies, price bases, populations, or publication statuses differ.
- Release auditing for invalid dates, non-finite values, duplicate periods,
  missing exports, negative-year carrier-text artifacts, and incomplete
  dataset metadata.

Generated data releases are intentionally not committed here. They can contain
hundreds of megabytes of observations and may include licensed source extracts.
The repository contains the code and contracts needed to rebuild them locally;
the live public release is served through the production data plane.

## Quick start

```bash
npm install
npm run typecheck
npm run build:app
```

To build a local release, configure the source credentials that you are
licensed to use, then run the relevant source builder or the complete build:

```bash
cp .env.example .env
npm run data:all
npm test
npm run audit:release
```

`npm run data:all` may require the adjacent source workspaces used by the
industrial and legacy NBU/State Statistics builders. See
[`docs/ingestion.md`](docs/ingestion.md) before running a network refresh.

## Local data lab

Each source can be kept in its own SQLite warehouse. This preserves source
methodology and lets one corner be rebuilt without rewriting unrelated data.
The read-only admin dashboard exposes dataset metadata, schema, row counts,
sample rows, and parameterized analytical SQL.

```bash
npm run admin:budget
# open http://127.0.0.1:4176
```

The other corner commands and the local schema are documented in
[`docs/local-data-lab.md`](docs/local-data-lab.md).

## API example

```bash
curl 'https://dataukraine.proto.fund/api/v1/ukraine/corners/imf/datasets/ngdp_rpch/series?start_year=2020&end_year=2031'
```

The response is bounded, carries source and status metadata, and is suitable
for a chart or model input. See [`docs/api.md`](docs/api.md) for endpoint
semantics and [`examples/cross-data.mjs`](examples/cross-data.mjs) for a
country comparison example.

## Data model

Every public dataset has a stable source code and graph code, bilingual title,
reader guidance, original source URL, coverage dates, frequency, unit, status,
and one or more normalized indicators. The normalized point contract keeps
the source date, period label, value, unit, forecast/partial flags, and
quality flags together. See [`docs/graph-contract.md`](docs/graph-contract.md).

No observation is silently converted into a final annual value. YTD, partial,
estimated, modelled, and forecast observations remain labelled. Source gaps
are reported in coverage files rather than filled with invented values.

## Architecture

```text
official/licensed sources
        -> adapters and local caches
        -> source SQLite data labs
        -> immutable JSON / CSV / Markdown release
        -> private GCS + Cloud Run read API
        -> Cloudflare Worker
        -> public catalogue, graphs, reports, and widgets
```

See [`ARCHITECTURE.md`](ARCHITECTURE.md) and
[`docs/provenance.md`](docs/provenance.md) for the release and trust model.
The Cloud Run and GCS boundary is specified in
[`docs/cloud-run-contract.md`](docs/cloud-run-contract.md).

## Repository status

This is the DataUkraine 0.1 transparency package. It is intended to make the
software architecture and analytical contracts inspectable. Source publishers
remain authoritative for the underlying observations, and their terms and
attributions apply to each source release.

## License

Application and connector code is released under the MIT License. Source data
remains subject to the terms of the original publisher. See [`LICENSE`](LICENSE).
