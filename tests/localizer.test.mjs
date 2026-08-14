import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  localizeRows,
  parseCsv,
  requiredTokensForRow,
  summarizeRows,
  toCsv,
  validateRow
} from "../src/localizer.js";

const suite = parseCsv(
  await readFile(new URL("../game-localization-difficulty-suite.csv", import.meta.url), "utf8")
);
const savedDifficultyOneToFour = parseCsv(
  await readFile(new URL("../game-localization-results-difficulty-1-4.csv", import.meta.url), "utf8")
);

describe("difficulty 1-4 result CSV", () => {
  const sourceRows = suite.rows.filter((row) => Number(row.difficulty) >= 1 && Number(row.difficulty) <= 4);

  it("keeps row count and key order", () => {
    assert.equal(savedDifficultyOneToFour.rows.length, sourceRows.length);
    assert.deepEqual(
      savedDifficultyOneToFour.rows.map((row) => row.key),
      sourceRows.map((row) => row.key)
    );
  });

  it("is parseable after CSV round trip", () => {
    const csv = toCsv(savedDifficultyOneToFour.rows, savedDifficultyOneToFour.headers);
    const reparsed = parseCsv(csv);
    assert.equal(reparsed.rows.length, savedDifficultyOneToFour.rows.length);
    assert.deepEqual(
      reparsed.rows.map((row) => row.key),
      savedDifficultyOneToFour.rows.map((row) => row.key)
    );
  });

  it("preserves required tokens", () => {
    for (const sourceRow of sourceRows) {
      const resultRow = savedDifficultyOneToFour.rows.find((row) => row.key === sourceRow.key);
      assert.ok(resultRow, `missing result row: ${sourceRow.key}`);

      const validation = validateRow(sourceRow, resultRow);
      assert.equal(validation.validation_status, "pass", `${sourceRow.key}: ${validation.validation_errors}`);

      for (const token of requiredTokensForRow(sourceRow)) {
        assert.ok(resultRow.translation_ko.includes(token), `${sourceRow.key} missing ${token}`);
      }
    }
  });
});

describe("app localization logic", () => {
  it("passes generated difficulty 1-4 validation", () => {
    const rows = suite.rows.filter((row) => Number(row.difficulty) >= 1 && Number(row.difficulty) <= 4);
    const localized = localizeRows(rows, { range: "all" });
    const summary = summarizeRows(localized);

    assert.equal(summary.total, 12);
    assert.equal(summary.translated, 12);
    assert.equal(summary.failed, 0);
    assert.ok(summary.passed / summary.total >= 0.95);
  });

  it("passes generated difficulty 5-6 format preservation", () => {
    const rows = suite.rows.filter((row) => Number(row.difficulty) >= 5 && Number(row.difficulty) <= 6);
    const localized = localizeRows(rows, { range: "all" });

    assert.equal(localized.length, 6);
    assert.equal(localized.filter((row) => row.validation_status === "pass").length, 6);
  });
});
