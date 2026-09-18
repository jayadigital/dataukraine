# Ingestion and release workflow

Each source adapter follows the same broad sequence:

```text
source API or bulk file
  -> cached response
  -> source-specific normalization
  -> SQLite warehouse
  -> metadata / provenance / quality checks
  -> bounded JSON, CSV and Markdown release
  -> GCS immutable release
  -> Cloud Run current pointer
  -> Cloudflare public UI and API
```

## Refresh modes

The default build can reuse local caches. Set `RI_REFRESH=1` only when a fresh
network request is intended. Source-specific limits and key requirements are
documented in `SOURCE_AUDIT.md` and each corner’s generated coverage report.

```bash
RI_REFRESH=1 npm run data:imf
RI_REFRESH=1 npm run data:eurostat
npm run audit:release
npm run build:app
```

The local release audit is a publication gate. It checks dates, values,
duplicate periods, exports, graph readiness, bilingual metadata, and known
carrier-text failure modes.

## Publishing

Publishing requires operator-only environment variables and is intentionally
not part of the public repository configuration:

- `GCS_BUCKET`
- `API_ORIGIN`
- `ADMIN_API_KEY`
- optional source API keys such as `TRADING_ECONOMICS_API_KEY`

Never commit `.env`, service-account JSON, bearer tokens, or local SQLite
warehouses. The public API is read-only; refresh and pointer changes happen in
the protected data plane.

The industrial and Uconomics builders use portable defaults for adjacent local
workspaces. Set `RI_ALPHA_ROOT` or `UC_ROOT` when those source workspaces live
elsewhere.
