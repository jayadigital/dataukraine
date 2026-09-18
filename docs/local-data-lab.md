# Local data lab

The local data lab is the research and QA surface behind the public flat-file
release. It is not required by the browser in production.

## Source warehouses

Use one SQLite database per source so source-specific schemas and raw rows stay
visible. The current local names include `ukraine-dataroom.sqlite`,
`wb-dataroom.sqlite`, `ilostat-dataroom.sqlite`, `imf-dataroom.sqlite`,
`eurostat-dataroom.sqlite`, `budget-dataroom.sqlite`, and the other source
corner warehouses. These files are ignored by GitHub because they are large
local working data, not the software contract.

The common analytical tables are:

- `datasets`: source dataset identity, title, unit, frequency, and provenance;
- `availability_values`: parameter and dimension values available to query;
- `observations`: normalized values plus `raw_json` and quality/status fields;
- `entities`: country, region, partner, classification, or instrument lookup.

## Admin server

```bash
npm run admin:budget
# http://127.0.0.1:4176
```

The dashboard is read-only. Analytical SQL is accepted only for `SELECT`,
`WITH`, and explainable read operations; mutations and arbitrary file access
are rejected. Source-specific admin commands are listed in `package.json`.

## Why not one production SQL database?

The public read path is optimized for bounded immutable files. Keeping source
warehouses local and publishing small release objects avoids an always-on
database for low-concurrency research workloads while preserving a path to
BigQuery or Cloud SQL when interactive joins and concurrent model workloads
justify the cost.
