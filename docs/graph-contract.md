# Graph contract

The UI renders a dataset from a normalized summary. A graph can be embedded by
stable dataset ID, but the graph code is the preferred cross-project identity.

## Identity

```json
{
  "id": "uc-u1-02-d1",
  "graphCodeBase": "UA-UC-0001",
  "titleUa": "Випуск сталі",
  "titleEn": "Steel production",
  "sourceReferences": [
    { "id": "wb-0001", "label": "World Bank", "url": "https://data.worldbank.org/" }
  ]
}
```

Dataset pages use `/id/{dataset-id}`. A graph-specific integration should use
`/id/{dataset-id}?chart={graph-code}` or the equivalent `/embed/` route. The
widget page contains a ready iframe example and lets the host application
control width and height without copying internal data files.

## Normalized indicator

```json
{
  "id": "uc-u1-02-d1-1",
  "idApi": "PROD_STEEL",
  "titleUa": "Випуск сталі",
  "titleEn": "Steel production",
  "unit": "млн тонн",
  "frequency": "A",
  "series": [
    {
      "date": "2024-12-31",
      "year": 2024,
      "value": 7.58,
      "label": "2024",
      "partial": false,
      "forecast": false,
      "qualityFlags": []
    }
  ]
}
```

Dates are ISO calendar dates. Values are numeric and finite. `label` is for
display and does not make a time series categorical. The graph renderer enables
line and area views for any multi-point numeric series; columns and tables
remain available. Pie charts require explicit categorical data, and Mekko is
enabled only when a future dataset supplies the required two-dimensional
contract.

## Status semantics

- `observed`: source-published observation.
- `estimated`: source estimate.
- `partial` or `ytd`: latest period is incomplete for the calendar year.
- `forecast`: published projection, kept separate from facts.
- `modelled`: model or editorial scenario value, not an official observation.
- `carrier-text`: qualitative source text retained as a fact, never a numeric
  year.

The renderer uses these flags for legends, hover text, reports, and export
metadata. A source gap is rendered as a gap rather than interpolated.
