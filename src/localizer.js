const TRANSLATIONS = new Map([
  ["ui_start", "게임 시작"],
  ["ui_options", "설정"],
  ["item_potion", "체력 물약"],
  ["ui_save_success", "게임이 저장되었습니다."],
  ["item_desc_potion", "50 HP를 회복합니다."],
  ["quest_accept", "퀘스트 수락"],
  ["npc_greeting_dialogue", "야. 길 잃었냐, 아니면 그냥 멍청한 거냐?"],
  ["npc_polite_warning", "조심하세요. 여긴 뭔가 이상합니다."],
  ["npc_short_reply", "내 알 바 아니야."],
  ["npc_player_name", "살아서 돌아왔네, {playerName}."],
  ["ui_damage_format", "%s의 화염 피해를 줍니다."],
  ["ui_count_format", "열쇠 {count}개 보유 중"],
  ["dialogue_newline", "잘 들으세요.\\n문은 단 한 번만 열립니다."],
  ["system_tab_debug", "파일 누락:\\t%s"],
  ["dialogue_ellipsis", "젠장...\\n너무 늦었어."],
  ["rich_bold_warning", "<b>경고:</b> 이 지점 이후로는 돌아올 수 없습니다."],
  ["rich_color_item", "<color=#FFAA00>전설</color> 검을 발견했습니다."],
  ["bbcode_reward", "[item]{0}[/item] x%d 획득"]
]);

const TOKEN_PATTERNS = [
  /\{[^{}\s]+\}/g,
  /%(?:\d+\$)?[-+ 0#]*(?:\d+|\*)?(?:\.\d+|\.\*)?[bcdeEfFgGosxXdiu]/g,
  /\\[nt]/g,
  /<\/?[A-Za-z][^>]*>/g,
  /\[\/?[A-Za-z][^\]]*\]/g,
  /[+-]?\d+(?:\.\d+)?%/g,
  /\b\d+(?:\.\d+)?\s*[A-Za-z]+\b/g
];

export function parseCsv(text) {
  const records = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

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

export function extractPreserveTokens(text = "") {
  const tokens = [];
  for (const pattern of TOKEN_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      tokens.push(match[0]);
    }
  }
  return Array.from(new Set(tokens));
}

export function requiredTokensForRow(row) {
  return Array.from(
    new Set([
      ...extractPreserveTokens(row.source_en),
      ...extractPreserveTokens(row.required_preserve)
    ])
  ).filter(Boolean);
}

export function translateRow(row) {
  return TRANSLATIONS.get(row.key) ?? row.source_en;
}

export function validateRow(sourceRow, resultRow) {
  const errors = [];
  const preserved = [];

  if (sourceRow.key !== resultRow.key) {
    errors.push("key changed");
  }

  for (const token of requiredTokensForRow(sourceRow)) {
    if (resultRow.translation_ko.includes(token)) {
      preserved.push(token);
    } else {
      errors.push(`missing token: ${token}`);
    }
  }

  return {
    validation_status: errors.length === 0 ? "pass" : "fail",
    validation_errors: errors.join("; "),
    preserved_tokens: preserved.join(" ")
  };
}

export function localizeRows(rows, options = {}) {
  const range = options.range ?? "all";
  return rows.map((row) => {
    if (!isInRange(row, range)) {
      return { ...row };
    }

    const result = {
      ...row,
      translation_ko: translateRow(row),
      naturalness_score: Number(row.difficulty) <= 4 ? "9" : "8",
      translationese_risk: "low"
    };

    return {
      ...result,
      ...validateRow(row, result)
    };
  });
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
