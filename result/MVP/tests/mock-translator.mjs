import { expectedRequiredTokensForRow } from "../src/localizer.js";

export class MockTranslator {
  translate(row) {
    const tokens = expectedRequiredTokensForRow(row);
    const base = baseTranslation(row);
    const signature = sourceSignature(row.source_en);
    const tokenSuffix = tokens.length > 0 ? ` ${tokens.join(" ")}` : "";

    return {
      translation_ko: `${base} ${signature}${tokenSuffix}`.trim(),
      naturalness_score: Number(row.difficulty) <= 4 ? 9 : 8,
      translationese_risk: "low"
    };
  }
}

function baseTranslation(row) {
  if (row.category === "ui") {
    return "모의 화면 문구";
  }
  if (row.category === "item") {
    return "모의 장비 문구";
  }
  if (row.category === "combat") {
    return "모의 전투 문구";
  }
  if (row.category === "lore") {
    return "모의 서사 문구";
  }
  return "모의 대사 문구";
}

function sourceSignature(value = "") {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.codePointAt(0)) % 9973;
  }
  return `#${hash.toString(36)}`;
}
