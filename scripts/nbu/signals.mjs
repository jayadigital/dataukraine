const severityRank = {
  critical: 0,
  watch: 1,
  context: 2,
  stable: 3,
};

function valueLabel(metric) {
  if (metric.deltaAbs === null) return "нова серія";
  if (metric.format === "percent") {
    const sign = metric.deltaAbs > 0 ? "+" : "";
    const digits = Math.abs(metric.deltaAbs) < 0.01 && metric.deltaAbs !== 0 ? 3 : 2;
    return `${sign}${metric.deltaAbs.toFixed(digits)} п.п.`;
  }
  const sign = metric.deltaPct > 0 ? "+" : "";
  return `${sign}${metric.deltaPct.toFixed(2)}%`;
}

function movement(metric) {
  if (metric.deltaAbs === null || Math.abs(metric.deltaAbs) < 0.0001) {
    return "без зміни";
  }
  return metric.deltaAbs > 0 ? "зростання" : "зниження";
}

function classify(metric) {
  const absolute =
    metric.format === "percent"
      ? Math.abs(metric.deltaAbs ?? 0)
      : Math.abs(metric.deltaPct ?? 0);
  const thresholds = {
    fx_usd: [1.5, 0.7],
    policy_rate: [0.5, 0.25],
    uonia: [0.5, 0.25],
    reserves: [3, 1.5],
    m3: [2.5, 1],
    loans: [2.5, 1],
    deposits: [2.5, 1],
    inflation: [1, 0.5],
  };
  const [critical, watch] = thresholds[metric.id] ?? [3, 1];
  if (absolute >= critical) return "critical";
  if (absolute >= watch) return "watch";
  if (absolute > 0) return "context";
  return "stable";
}

const labelByLevel = {
  critical: "Критично",
  watch: "Варто стежити",
  context: "Контекст",
  stable: "Стабільно",
};

const titleTemplates = {
  fx_usd: (direction) => `Курс долара: ${direction}`,
  policy_rate: (direction) => `Облікова ставка: ${direction}`,
  uonia: (direction) => `UONIA: ${direction}`,
  reserves: (direction) => `Міжнародні резерви: ${direction}`,
  m3: (direction) => `Грошова маса M3: ${direction}`,
  loans: (direction) => `Банківські кредити: ${direction}`,
  deposits: (direction) => `Депозити: ${direction}`,
  inflation: (direction) => `Інфляція: ${direction}`,
};

export function buildSignals(metrics) {
  return metrics
    .map((metric) => {
      const level = classify(metric);
      const direction = movement(metric);
      return {
        id: `signal-${metric.id}`,
        metricId: metric.id,
        level,
        label: labelByLevel[level],
        title: titleTemplates[metric.id](direction),
        body: `${metric.shortTitle}: останнє значення за ${metric.currentDate}; порівняння ${metric.comparisonLabel}.`,
        value: valueLabel(metric),
      };
    })
    .sort(
      (left, right) =>
        severityRank[left.level] - severityRank[right.level] ||
        Math.abs(
          (metrics.find((metric) => metric.id === right.metricId)?.deltaPct ??
            metrics.find((metric) => metric.id === right.metricId)?.deltaAbs ??
            0),
        ) -
          Math.abs(
            metrics.find((metric) => metric.id === left.metricId)?.deltaPct ??
              metrics.find((metric) => metric.id === left.metricId)?.deltaAbs ??
              0,
          ),
    );
}

export function buildWeeklyReport(signals, generatedAt) {
  const material = signals.filter((signal) => signal.level !== "stable");
  const lead = material[0] ?? signals[0];
  return {
    title: "Тижневий сигнал-монітор економіки України",
    deck: lead
      ? `${lead.title}. ${lead.body}`
      : "Матеріальних змін у доступних даних не виявлено.",
    generatedAt,
    highlights: (material.length ? material : signals).slice(0, 5).map((signal) => ({
      level: signal.level,
      title: signal.title,
      body: `${signal.body} Зміна: ${signal.value}.`,
    })),
  };
}
