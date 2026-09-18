# Cross-data requests

DataUkraine keeps source observations separate and adds a small semantic layer
for safe comparisons. It does not merge rows merely because two titles look
similar.

## Comparison checklist

Before overlaying two series, confirm:

- same concept and population;
- same unit and multiplier;
- same frequency and period convention;
- same price basis and seasonal adjustment;
- same geography and classification;
- compatible release date and status.

If one series is YTD, partial, estimated, modelled, or forecast, retain that
status in the comparison. Matching calendar windows are safer than comparing
a full year with an incomplete year.

## API pattern

1. Discover the source datasets through `/corners/{corner}/datasets`.
2. Resolve each selected dataset to a stable ID and graph code.
3. Request bounded series with the same year window.
4. Align dates in the client, preserving missing values.
5. Render the selected countries or sources as separate series.

The `examples/cross-data.mjs` script follows this pattern for IMF GDP growth.
For a richer comparison, use the catalogue’s curated families in the universal
release and inspect their unit and methodology fields before plotting.
