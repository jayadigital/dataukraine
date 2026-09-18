import assert from "node:assert/strict";
import test from "node:test";

import { magazineArticles } from "../src/magazine.ts";

test("Magazine ships seven bilingual, source-backed articles", () => {
  assert.equal(magazineArticles.length, 7);

  for (const article of magazineArticles) {
    const uaLength = article.paragraphsUa.join("\n").length;
    const enLength = article.paragraphsEn.join("\n").length;

    assert.ok(uaLength >= 1_000 && uaLength <= 5_000, `${article.number} UA length`);
    assert.ok(enLength >= 1_000 && enLength <= 5_000, `${article.number} EN length`);
    assert.ok(article.sources.length >= 3, `${article.number} sources`);
    assert.ok(article.related.length >= 2, `${article.number} related datasets`);
    assert.ok(article.chart.points.length >= 2, `${article.number} chart points`);
  }
});

test("historical labour article preserves the post-2021 data gap", () => {
  const article = magazineArticles.find(
    (item) => item.slug === "ukraine-labour-1991-2025",
  );

  assert.ok(article);
  assert.equal(article.chart.points.at(-1)?.year, 2021);
  assert.match(article.standfirstUa, /прогалину/u);
  assert.match(article.standfirstEn, /gap/iu);
});
