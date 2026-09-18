import test from "node:test";
import assert from "node:assert/strict";
import { buildSignals } from "./signals.mjs";

test("classifies a material policy-rate move as critical", () => {
  const [signal] = buildSignals([
    {
      id: "policy_rate",
      shortTitle: "Облікова ставка",
      format: "percent",
      current: 14,
      currentDate: "2026-07-24",
      previous: 15,
      previousDate: "2026-07-17",
      deltaAbs: -1,
      deltaPct: -6.67,
      comparisonLabel: "за 7 днів",
    },
  ]);
  assert.equal(signal.level, "critical");
  assert.match(signal.value, /-1\.00 п\.п\./);
});

test("keeps an unchanged metric stable", () => {
  const [signal] = buildSignals([
    {
      id: "uonia",
      shortTitle: "UONIA",
      format: "percent",
      current: 15,
      currentDate: "2026-07-24",
      previous: 15,
      previousDate: "2026-07-23",
      deltaAbs: 0,
      deltaPct: 0,
      comparisonLabel: "до попереднього дня",
    },
  ]);
  assert.equal(signal.level, "stable");
});
