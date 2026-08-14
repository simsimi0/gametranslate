import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { OpenAITranslator } from "../src/openai-translator.js";
import {
  CSV_UTF8_BOM,
  expectedRequiredTokensForRow,
  localizeRows,
  parseCsv,
  resultHeaders,
  summarizeRows,
  toCsv,
  toCsvWithBom,
  translateRow,
  validateRow
} from "../src/localizer.js";
import { MockTranslator } from "./mock-translator.mjs";

const suite = parseCsv(await readFile(new URL("../game-localization-difficulty-suite.csv", import.meta.url), "utf8"));
const holdoutSuite = parseCsv(await readFile(new URL("../final-holdout-generalization-suite.csv", import.meta.url), "utf8"));
const retestSuite = parseCsv(
  await readFile(new URL("../final-retest-generalization-suite-v2.csv", import.meta.url), "utf8")
);
const retestV3Suite = parseCsv(
  await readFile(new URL("../final-retest-generalization-suite-v3.csv", import.meta.url), "utf8")
);

const indexHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
const localizerSource = await readFile(new URL("../src/localizer.js", import.meta.url), "utf8");
const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const openaiTranslatorSource = await readFile(new URL("../src/openai-translator.js", import.meta.url), "utf8");
const mockTranslatorSource = await readFile(new URL("./mock-translator.mjs", import.meta.url), "utf8");
const testSource = await readFile(new URL("./localizer.test.mjs", import.meta.url), "utf8");
const productSources = [localizerSource, appSource, openaiTranslatorSource].join("\n");
const scannedSources = [productSources, mockTranslatorSource, testSource].join("\n");
const mockTranslator = new MockTranslator();

const savedDifficultyOneToFour = parseCsv(
  await readFile(new URL("../game-localization-results-difficulty-1-4.csv", import.meta.url), "utf8")
);
const savedDifficultyFiveToSix = parseCsv(
  await readFile(new URL("../game-localization-results-difficulty-5-6.csv", import.meta.url), "utf8")
);
const savedDifficultySevenToNine = parseCsv(
  await readFile(new URL("../game-localization-results-difficulty-7-9.csv", import.meta.url), "utf8")
);
const savedDifficultyTenToTwelve = parseCsv(
  await readFile(new URL("../game-localization-results-difficulty-10-12.csv", import.meta.url), "utf8")
);
const savedFinalHoldout = parseCsv(
  await readFile(new URL("../final-holdout-results-source-based.csv", import.meta.url), "utf8")
);
const savedFinalRetest = parseCsv(await readFile(new URL("../final-retest-results-v2.csv", import.meta.url), "utf8"));
const savedFinalRetestV3 = parseCsv(await readFile(new URL("../final-retest-results-v3.csv", import.meta.url), "utf8"));
const savedFinalRetestV3Json = JSON.parse(
  await readFile(new URL("../final-retest-results-v3.json", import.meta.url), "utf8")
);

const resultCsvUrls = [
  new URL("../game-localization-results-difficulty-1-4.csv", import.meta.url),
  new URL("../game-localization-results-difficulty-5-6.csv", import.meta.url),
  new URL("../game-localization-results-difficulty-7-9.csv", import.meta.url),
  new URL("../game-localization-results-difficulty-10-12.csv", import.meta.url),
  new URL("../final-holdout-results-source-based.csv", import.meta.url),
  new URL("../final-retest-results-v2.csv", import.meta.url),
  new URL("../final-retest-results-v3.csv", import.meta.url)
];

const fixtureResults = [
  {
    label: "difficulty 1-4",
    sourceRows: suite.rows.filter((row) => Number(row.difficulty) >= 1 && Number(row.difficulty) <= 4),
    result: savedDifficultyOneToFour,
    noFallback: false
  },
  {
    label: "difficulty 5-6",
    sourceRows: suite.rows.filter((row) => Number(row.difficulty) >= 5 && Number(row.difficulty) <= 6),
    result: savedDifficultyFiveToSix,
    noFallback: false
  },
  {
    label: "difficulty 7-9",
    sourceRows: suite.rows.filter((row) => Number(row.difficulty) >= 7 && Number(row.difficulty) <= 9),
    result: savedDifficultySevenToNine,
    noFallback: false
  },
  {
    label: "difficulty 10-12",
    sourceRows: suite.rows.filter((row) => Number(row.difficulty) >= 10 && Number(row.difficulty) <= 12),
    result: savedDifficultyTenToTwelve,
    noFallback: true
  },
  {
    label: "final holdout",
    sourceRows: holdoutSuite.rows,
    result: savedFinalHoldout,
    noFallback: true
  },
  {
    label: "final retest v2",
    sourceRows: retestSuite.rows,
    result: savedFinalRetest,
    noFallback: true
  },
  {
    label: "final retest v3",
    sourceRows: retestV3Suite.rows,
    result: savedFinalRetestV3,
    noFallback: true
  }
];

describe("CSV encoding", () => {
  it("writes generated CSV with UTF-8 BOM", () => {
    const csv = toCsvWithBom(savedDifficultyOneToFour.rows, savedDifficultyOneToFour.headers);
    const parsed = parseCsv(csv);

    assert.equal(csv.startsWith(CSV_UTF8_BOM), true);
    assert.equal(parsed.rows.length, savedDifficultyOneToFour.rows.length);
  });

  it("saved result CSV files include UTF-8 BOM for Excel", async () => {
    for (const url of resultCsvUrls) {
      const bytes = await readFile(url);
      assert.deepEqual(Array.from(bytes.subarray(0, 3)), [0xef, 0xbb, 0xbf], url.pathname);
    }
  });
});

describe("saved result CSVs", () => {
  for (const fixture of fixtureResults) {
    it(`${fixture.label}: keeps row count and key order`, () => {
      assert.equal(fixture.result.rows.length, fixture.sourceRows.length);
      assert.deepEqual(
        fixture.result.rows.map((row) => row.key),
        fixture.sourceRows.map((row) => row.key)
      );
    });

    it(`${fixture.label}: is parseable after CSV round trip`, () => {
      const reparsed = parseCsv(toCsv(fixture.result.rows, fixture.result.headers));
      assert.equal(reparsed.rows.length, fixture.result.rows.length);
      assert.deepEqual(
        reparsed.rows.map((row) => row.key),
        fixture.result.rows.map((row) => row.key)
      );
    });

    it(`${fixture.label}: preserves required tokens and passes validation`, () => {
      for (const sourceRow of fixture.sourceRows) {
        const resultRow = fixture.result.rows.find((row) => row.key === sourceRow.key);
        assert.ok(resultRow, `missing result row: ${sourceRow.key}`);

        const validation = validateRow(sourceRow, resultRow);
        assert.equal(validation.validation_status, "pass", `${sourceRow.key}: ${validation.validation_errors}`);

        for (const token of expectedRequiredTokensForRow(sourceRow)) {
          assert.ok(resultRow.translation_ko.includes(token), `${sourceRow.key} missing ${token}`);
        }
      }
    });

    if (fixture.noFallback) {
      it(`${fixture.label}: does not use English fallback`, () => {
        for (const row of fixture.result.rows) {
          assert.notEqual(row.translation_ko, row.source_en, row.key);
          assert.equal(row.translation_ko.length > 0, true, row.key);
        }
      });
    }
  }

  it("localizes Ashen Keep as 잿빛 성채", () => {
    const loreRow = savedDifficultySevenToNine.rows.find((row) => row.key === "lore_high_fantasy");

    assert.ok(loreRow.translation_ko.includes("잿빛 성채"));
    assert.equal(loreRow.translation_ko.includes("Ashen Keep"), false);
  });

  it("passes final difficulty 13 format preservation at 100%", () => {
    const rows = [...savedFinalHoldout.rows, ...savedFinalRetest.rows, ...savedFinalRetestV3.rows].filter(
      (row) => Number(row.difficulty) === 13
    );

    assert.equal(rows.length, 9);
    assert.equal(rows.every((row) => row.validation_status === "pass"), true);
  });

  it("keeps final difficulty 9-12 average at 8 or higher", () => {
    for (const result of [savedFinalHoldout, savedFinalRetest, savedFinalRetestV3]) {
      const rows = result.rows.filter((row) => Number(row.difficulty) >= 9 && Number(row.difficulty) <= 12);
      const average = rows.reduce((total, row) => total + Number(row.naturalness_score), 0) / rows.length;
      assert.ok(average >= 8);
    }
  });

  it("final retest v3 is not generated by MockTranslator", () => {
    for (const row of savedFinalRetestV3.rows) {
      assert.equal(/^모의 .+ 문구 #[0-9a-z]+(?:\s|$)/u.test(row.translation_ko), false, row.key);
    }
  });

  it("final retest v3 JSON mirrors CSV and keeps readable Korean", () => {
    const jsonRows = Object.entries(savedFinalRetestV3Json.entries).map(([key, row]) => ({ key, ...row }));

    assert.equal(savedFinalRetestV3Json.meta.row_count, savedFinalRetestV3.rows.length);
    assert.deepEqual(
      jsonRows.map((row) => row.key),
      savedFinalRetestV3.rows.map((row) => row.key)
    );

    for (const row of jsonRows) {
      assert.equal(row.validation_status, "pass", row.key);
      assert.equal(/\p{Script=Hangul}/u.test(row.translation_ko), true, row.key);
      assert.equal(row.translation_ko.includes("??"), false, row.key);
      assert.equal(/^모의 .+ 문구 #[0-9a-z]+(?:\s|$)/u.test(row.translation_ko), false, row.key);
    }
  });
});

describe("translator interface", () => {
  it("requires translator.translate(row)", async () => {
    await assert.rejects(localizeRows(suite.rows, { range: "1-4" }), /translator\.translate/);
  });

  it("localizeRows uses the injected translator and keeps validation in localizer", async () => {
    const localized = await localizeRows(suite.rows, mockTranslator, { range: "1-4" });
    const summary = summarizeRows(localized);

    assert.equal(summary.total, 12);
    assert.equal(summary.translated, 12);
    assert.equal(summary.failed, 0);
    assert.equal(localized.every((row) => row.validation_status === "pass"), true);
  });

  it("source text can change translator output with equal metadata", async () => {
    const metadata = {
      difficulty: "1",
      key: "generalization_probe",
      category: "ui",
      speaker: "System",
      context: "Same UI slot",
      style_guide: "간결한 버튼",
      required_preserve: ""
    };

    const first = await translateRow({ ...metadata, source_en: "Start Game" }, mockTranslator);
    const second = await translateRow({ ...metadata, source_en: "Options" }, mockTranslator);

    assert.notEqual(first.translation_ko, second.translation_ko);
  });

  it("OpenAITranslator parses JSON responses", async () => {
    const translator = new OpenAITranslator({
      apiKey: "test",
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          output_text: JSON.stringify({
            translation_ko: "테스트 {playerName}",
            naturalness_score: 8,
            translationese_risk: "low"
          })
        })
      })
    });

    const result = await translator.translate({
      key: "probe",
      category: "dialogue",
      speaker: "System",
      context: "",
      source_en: "Hello, {playerName}.",
      style_guide: "",
      required_preserve: "{playerName}"
    });

    assert.equal(result.translation_ko, "테스트 {playerName}");
    assert.equal(result.naturalness_score, 8);
    assert.equal(result.translationese_risk, "low");
  });
});

describe("app localization logic", () => {
  for (const [range, expected] of [
    ["1-4", 12],
    ["5-6", 6],
    ["7-9", 9],
    ["10-12", 9]
  ]) {
    it(`exports only difficulty ${range} rows from a full CSV input`, async () => {
      const localized = await localizeRows(suite.rows, mockTranslator, { range });
      const exported = parseCsv(toCsv(localized, resultHeaders(suite.headers)));

      assert.equal(localized.length, expected);
      assert.equal(exported.rows.length, expected);
      assert.deepEqual(
        exported.rows.map((row) => row.key),
        suite.rows.filter((row) => isWithinRange(row, range)).map((row) => row.key)
      );
    });
  }

  it("exports difficulty 13 rows from a full holdout CSV input", async () => {
    const localized = await localizeRows(holdoutSuite.rows, mockTranslator, { range: "13-13" });
    const exported = parseCsv(toCsv(localized, resultHeaders(holdoutSuite.headers)));

    assert.equal(localized.length, 3);
    assert.equal(exported.rows.length, 3);
    assert.deepEqual(
      exported.rows.map((row) => row.key),
      holdoutSuite.rows.filter((row) => Number(row.difficulty) === 13).map((row) => row.key)
    );
  });

  it("does not depend on style guide for retest sample validation", async () => {
    const sample = [...retestSuite.rows.slice(0, 5), ...retestV3Suite.rows.slice(0, 5)].map((row) => ({
      ...row,
      style_guide: ""
    }));
    const localized = await localizeRows(sample, mockTranslator, { range: "all" });

    assert.equal(localized.length, 10);
    assert.equal(localized.every((row) => row.validation_status === "pass"), true);
  });
});

describe("generalization guard", () => {
  it("does not expose an all-range button", () => {
    assert.equal(indexHtml.includes('data-range="all"'), false);
    assert.equal(indexHtml.includes(">전체<"), false);
  });

  it("keeps product localizer free of translation dictionaries and source phrase branches", () => {
    assert.equal(/TRANSLATIONS\s*=|new Map\s*\(\s*\[/.test(localizerSource), false);
    assert.equal(/translate(?:From|Structured|Short|Sentence|Literary|Generic)Source/.test(localizerSource), false);
    assert.equal(/hasWord\s*\(/.test(localizerSource), false);
  });

  it("keeps mock translation logic out of src", () => {
    assert.equal(productSources.includes("MockTranslator"), false);
  });

  it("does not hardcode holdout or retest keys, source text, context, or challenge text in src/tests", () => {
    const normalizedSource = normalizeForStaticScan(scannedSources);

    assertNoDatasetHardcoding(holdoutSuite.rows, normalizedSource, scannedSources, "holdout");
    assertNoDatasetHardcoding(retestSuite.rows, normalizedSource, scannedSources, "retest");
    assertNoDatasetHardcoding(retestV3Suite.rows, normalizedSource, scannedSources, "retest v3");
  });

  it("does not keep uncommon retest source terms in product code", () => {
    const normalizedProduct = normalizeForStaticScan(productSources);

    for (const word of uncommonSourceWords([...retestSuite.rows, ...retestV3Suite.rows])) {
      assert.equal(normalizedProduct.includes(word), false, `product source contains retest source term: ${word}`);
    }
  });
});

function assertNoDatasetHardcoding(rows, normalizedSource, rawSource, label) {
  for (const row of rows) {
    assert.equal(rawSource.includes(row.key), false, `hardcoded ${label} key: ${row.key}`);

    for (const field of ["source_en", "context", "expected_challenge"]) {
      for (const fragment of sourceFragments(row[field])) {
        assert.equal(
          normalizedSource.includes(fragment),
          false,
          `hardcoded ${label} ${field} fragment for ${row.key}: ${fragment}`
        );
      }
    }
  }
}

function isWithinRange(row, range) {
  const [min, max] = range.split("-").map(Number);
  const difficulty = Number(row.difficulty);
  return difficulty >= min && difficulty <= max;
}

function normalizeForStaticScan(text) {
  return text
    .toLowerCase()
    .replace(/\\s\+/g, " ")
    .replace(/\\b/g, "")
    .replace(/\\\./g, ".")
    .replace(/\\\?/g, "?")
    .replace(/\\\//g, "/")
    .replace(/[^\p{L}\p{N}%{}[\].'-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceFragments(source = "") {
  const words = normalizeForStaticScan(source).match(/[%{}\[\].'\-\p{L}\p{N}]+/gu) ?? [];
  const fragments = new Set();

  for (let size = 2; size <= 4; size += 1) {
    for (let index = 0; index <= words.length - size; index += 1) {
      const fragment = words.slice(index, index + size).join(" ");
      if (!isCommonFragment(fragment)) {
        fragments.add(fragment);
      }
    }
  }

  for (const word of words) {
    if (word.includes("-") && word.length >= 6) {
      fragments.add(word);
    }
  }

  return fragments;
}

function uncommonSourceWords(rows) {
  const words = new Set();
  for (const row of rows) {
    for (const word of normalizeForStaticScan(row.source_en).match(/\p{L}[\p{L}'-]{5,}/gu) ?? []) {
      if (!isCommonWord(word)) {
        words.add(word);
      }
    }
  }
  return words;
}

function isCommonFragment(fragment) {
  return /^(the|a|an|it|to|for|with|of|in|on|and|or|but|not|do|did|now|this|that|you|your|their|our|is|are|was|were|has|have|had|if|when|before|after|exactly)(\s|$)/u.test(
    fragment
  );
}

function isCommonWord(word) {
  return /^(before|after|should|would|could|really|exactly|first|again|there|their|button|required|passed|target|warning|system|player|format|source|translate|translation)$/u.test(
    word
  );
}
