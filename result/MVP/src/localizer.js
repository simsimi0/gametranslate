const GLOSSARY_TERMS = { "Ashen Keep": "잿빛 성채" };
export const CSV_UTF8_BOM = "\uFEFF";

export const RESULT_FIELDS = [
  "translation_ko",
  "naturalness_score",
  "translationese_risk",
  "preserved_tokens",
  "validation_status",
  "validation_errors"
];

const TOKEN_PATTERNS = [
  /\\\\[A-Za-z]\[[^\]]+\]/g,
  /(?<!\\)\\[A-Za-z]\[[^\]]+\]/g,
  /\{[^{}\s]+\}/g,
  /%(?:\d+\$)?[-+0#]*(?:\d+|\*)?(?:\.\d+|\.\*)?[bcdeEfFgGosxXdiu]/g,
  /%%/g,
  /\\[nt]/g,
  /<\/?[A-Za-z][^>]*>/g,
  /\[\/?[A-Za-z][^\]]*\]/g,
  /[+-]?\d+(?:\.\d+)?%/g,
  /(?<![%.\w])\d+(?:\.\d+)?\s+[A-Za-z]+\b/g
];

const SOURCE_TOKEN_PATTERNS = [
  /\\\\[A-Za-z]\[[^\]]+\]/g,
  /(?<!\\)\\[A-Za-z]\[[^\]]+\]/g,
  /\{[^{}\s]+\}/g,
  /%(?:\d+\$)?[-+0#]*(?:\d+|\*)?(?:\.\d+|\.\*)?[bcdeEfFgGosxXdiu]/g,
  /%%/g,
  /\\[nt]/g,
  /<\/?[A-Za-z][^>]*>/g,
  /\[\/?[A-Za-z][^\]]*\]/g,
  /[+-]?\d+(?:\.\d+)?%/g
];

export function parseCsv(text) {
  const input = text.startsWith(CSV_UTF8_BOM) ? text.slice(1) : text;
  const records = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(field);
      if (row.some((value) => value.length > 0)) {
        records.push(row);
      }
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((value) => value.length > 0)) {
    records.push(row);
  }

  if (records.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = records[0].map((header) => header.trim());
  const rows = records.slice(1).map((values) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = values[index] ?? "";
    });
    return item;
  });

  return { headers, rows };
}

export function toCsv(rows, preferredHeaders = []) {
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set(preferredHeaders))
  );

  const escapeField = (value) => {
    const text = value == null ? "" : String(value);
    if (/[",\r\n]/.test(text)) {
      return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
  };

  return [
    headers.map(escapeField).join(","),
    ...rows.map((row) => headers.map((header) => escapeField(row[header])).join(","))
  ].join("\r\n");
}

export function toCsvWithBom(rows, preferredHeaders = []) {
  return CSV_UTF8_BOM + toCsv(rows, preferredHeaders);
}

export function resultHeaders(inputHeaders = []) {
  return Array.from(new Set([...inputHeaders, ...RESULT_FIELDS]));
}

export function extractPreserveTokens(text = "") {
  return extractTokens(text, TOKEN_PATTERNS);
}

export function requiredTokensForRow(row) {
  return Array.from(
    new Set([
      ...extractTokens(row.source_en, SOURCE_TOKEN_PATTERNS),
      ...extractPreserveTokens(row.required_preserve),
      ...extractLiteralPreserveTokens(row.required_preserve)
    ])
  ).filter(Boolean);
}

export function expectedRequiredTokensForRow(row) {
  return requiredTokensForRow(row).map((token) => GLOSSARY_TERMS[token] ?? token);
}

export async function translateRow(row, translator) {
  assertTranslator(translator);
  return normalizeTranslatorResult(await translator.translate(row));
}

export async function localizeRows(rows, translator, options = {}) {
  assertTranslator(translator);
  const range = options.range ?? "all";
  const localized = [];

  for (const row of rows.filter((item) => isInRange(item, range))) {
    localized.push(await localizeRow(row, translator));
  }

  return localized;
}

export async function localizeRow(row, translator) {
  let translation;
  let translatorError = "";

  try {
    translation = await translateRow(row, translator);
  } catch (error) {
    translation = {
      translation_ko: "",
      naturalness_score: "",
      translationese_risk: "high"
    };
    translatorError = error instanceof Error ? error.message : String(error);
  }

  const result = {
    ...row,
    translation_ko: translation.translation_ko,
    naturalness_score: translation.naturalness_score,
    translationese_risk: translation.translationese_risk
  };
  const validation = validateRow(row, result);

  if (translatorError) {
    validation.validation_status = "fail";
    validation.validation_errors = [validation.validation_errors, `translator error: ${translatorError}`]
      .filter(Boolean)
      .join("; ");
  }

  return {
    ...result,
    ...validation
  };
}

export function validateRow(sourceRow, resultRow) {
  const errors = [];
  const preserved = [];

  if (sourceRow.key !== resultRow.key) {
    errors.push("key changed");
  }

  if (!resultRow.translation_ko) {
    errors.push("missing translation");
  }

  for (const token of requiredTokensForRow(sourceRow)) {
    const expectedToken = GLOSSARY_TERMS[token] ?? token;
    if (resultRow.translation_ko.includes(expectedToken)) {
      preserved.push(expectedToken);
    } else {
      errors.push(`missing token: ${expectedToken}`);
    }
  }

  return {
    validation_status: errors.length === 0 ? "pass" : "fail",
    validation_errors: errors.join("; "),
    preserved_tokens: preserved.join(" ")
  };
}

export function summarizeRows(rows) {
  return rows.reduce(
    (summary, row) => {
      summary.total += 1;
      if (row.translation_ko) {
        summary.translated += 1;
      }
      if (row.validation_status === "pass") {
        summary.passed += 1;
      }
      if (row.validation_status === "fail") {
        summary.failed += 1;
      }
      return summary;
    },
    { total: 0, translated: 0, passed: 0, failed: 0 }
  );
}

export function isInRange(row, range) {
  if (range === "all") {
    return true;
  }
  const [min, max] = range.split("-").map(Number);
  const difficulty = Number(row.difficulty);
  return difficulty >= min && difficulty <= max;
}

function normalizeTranslatorResult(payload) {
  const value = typeof payload === "string" ? { translation_ko: payload } : payload ?? {};
  return {
    translation_ko: String(value.translation_ko ?? "").trim(),
    naturalness_score: value.naturalness_score == null ? "" : String(value.naturalness_score),
    translationese_risk: String(value.translationese_risk ?? "")
  };
}

function assertTranslator(translator) {
  if (!translator || typeof translator.translate !== "function") {
    throw new TypeError("translator.translate(row) is required");
  }
}

function extractLiteralPreserveTokens(text = "") {
  let remainder = text.trim();
  if (!remainder) {
    return [];
  }

  for (const token of extractPreserveTokens(text)) {
    remainder = remainder.replaceAll(token, " ");
  }

  const literal = remainder.replace(/\s+/g, " ").trim();
  return literal ? [literal] : [];
}

function extractTokens(text = "", patterns = TOKEN_PATTERNS) {
  const tokens = [];
  for (const pattern of patterns) {
    for (const match of String(text).matchAll(pattern)) {
      tokens.push(match[0]);
    }
  }
  return Array.from(new Set(tokens));
}
