# ProtoFund Ukraine Dataroom

ProtoFund is a downstream product of Osnova: a trusted public-data layer for
parametric foresight, policy modelling and transparent economic risk analysis.

## Storage decision

The dataroom keeps ten source SQLite warehouses instead of one merged database.
Each warehouse is the authoritative local ingestion and provenance store for its
source. A small universal SQLite registry and bounded JSON files hold only
cross-source metadata, comparison definitions, annual frames and forecast
coverage.

This avoids a fragile 1.28-million-row operational merge, lets one source be
rebuilt without locking the others, and keeps methodology differences visible.
The browser never opens SQLite. It requests small immutable files from private
GCS through the Cloud Run API.

## Public architecture

1. Local macOS jobs fetch source APIs and rebuild source-specific SQLite.
2. Each source publishes an immutable GCS release.
3. Cloud Run validates the release and atomically updates its `current.json`
   pointer.
4. The universal release references the ten current source contracts.
5. Cloudflare serves the UI and proxies public read-only API calls.
6. Refresh POST endpoints remain protected by the Cloud Run admin token.

## Refresh commands

```bash
# Full local monthly refresh, report and validation
npm run refresh:monthly

# NBU plus short-horizon signal sources
npm run refresh:weekly

# Build, validate, publish source releases, publish universal release and deploy UI
npm run publish:monthly
```

Use `--cached` for a deterministic rebuild from local cache and
`--no-editorial` to skip the optional report review. If `PHI_CMD` and
`MAMAY_CMD` are configured, the report review launches each local model,
captures its output and exits the process before publication.

Publishing requires `GCS_BUCKET`, `API_ORIGIN` and `ADMIN_API_KEY` in the local
environment. Public GET endpoints never require those credentials.

## Forecast rule

Forecasts remain separate by publisher and release date. ProtoFund does not
average them and does not extrapolate beyond the published horizon. The current
room shows NBU through 2028, World Bank through 2028, IMF through 2031 and an
explicit no-published-value state for 2032–2035.
