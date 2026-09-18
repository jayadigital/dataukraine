# Source Audit

Generated from live official sources on 2026-07-29.

## National Sources

### NBU

The existing NBU corner contributes 26 analytical datasets and 264,008
observations. The informative government-securities directory is intentionally
excluded. Detailed coverage and publication-gap notes remain in the NBU
corner's own audit.

### State Statistics

The existing statistics corner contributes 33 analytical datasets and 24,430
observations, including labour and regional perspectives. Interrupted series
are displayed through their available dates rather than hidden or imputed.

### Open Budget

Included nine general execution views for income, three expense
classifications, two financing views, and three credit views. Every available
annual snapshot from 2018 through June 2026 YTD is retained with budget type,
fund type, classification code, plan/fact fields, and raw source rows.

The 217,072-record `BUDG` dictionary and 2,124 active budget entities are kept
locally for future regional joins. Exhaustive `localBudgetData` and
`localBudgetReport` history remains deferred because each call requires a
specific `codebudg`; the dictionary is the reproducible backfill queue.

## International Sources

### OECD

Ten live flows include revenues, fossil-fuel support, aid, recipient-country
GNI and population, FDI restrictiveness, health-workforce migration,
greenhouse-gas indicators, and subnational finance. A flow is accepted only
when its current content constraint confirms `UKR`. Ten rejected or deferred
candidates are named in the coverage report. OECD's 60-request-per-hour limit
makes the local cache part of the ingestion contract.

### World Bank

The room contains 1,350 WDI indicators with non-null Ukraine observations and
one Global Economic Prospects GDP-growth forecast series. Data360 provides the
catalogue reference; official Indicators API source `2` supplies WDI history,
and source `27` supplies GEP forecasts. Data360 live paging timed out in this
build, and 28 catalogue identifiers absent from current source-2 metadata were
reported rather than invented.

### ILOSTAT

The official country bulk endpoint yielded 203,451 source rows for Ukraine.
After retaining numeric annual observations, the room contains 424 indicators
and 198,213 observations from 1959 to 2030. Indicator, sex, classification,
and observation-status dictionaries are joined into the local warehouse.

### IMF

The public IMF DataMapper v2 catalogue exposes 132 indicators. Ninety-seven
currently contain Ukraine values, producing 2,247 observations from 1991 to
2031; 160 points are marked as forecasts using the official projection-year
metadata. Thirty-five indicators without Ukraine observations are explicit
audit failures. The newer signed-in IMF portal API is not required for this
public WEO-compatible room.

### Eurostat

The official metabase listed 404 dataset codes with `geo=UA`. A complete live
sweep accepted 336 annual rooms and 648,093 observations from 1970 to 2025.
Sixty-eight cubes are explicit empty or deferred items. Large responses that
return Eurostat's `413` asynchronous-download instruction are not silently
truncated.

### UN Comtrade

The public preview API provides 99 rooms: one annual total-trade view and 98
HS2 commodity histories, with a latest partner view in the export. The room
contains 6,017 observations from 1996 to 2024. The current public contract
returned no annual Ukraine records for 1992-1995 or 2025-2026.

### Trading Economics

The public Ukraine forecast page currently exposes 41 indicators with actual
values and four quarterly forecast horizons, producing 178 observations and
137 forecast points. The discontinued guest API returns a subscription error.
Authenticated history and the complete forecast API are therefore a visible
key-gated gap until `TRADING_ECONOMICS_API_KEY` is configured.

## Comparison Safety

The universal desk provides curated mappings for GDP growth, inflation,
unemployment, public debt, and the external balance. A comparison records the
source code, unit, frequency, methodology role, release date, and whether a
point is fact, estimate, YTD, partial, or forecast. Similar names alone never
make two series comparable.
