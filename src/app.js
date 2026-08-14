import { isInRange, localizeRows, parseCsv, summarizeRows, toCsv } from "./localizer.js";

const fileInput = document.querySelector("#csvFile");
const translateButton = document.querySelector("#translateBtn");
const downloadButton = document.querySelector("#downloadBtn");
const fileStatus = document.querySelector("#fileStatus");
const rowsBody = document.querySelector("#rowsBody");
const rangeButtons = Array.from(document.querySelectorAll("[data-range]"));
const metrics = {
  total: document.querySelector("#totalRows"),
  translated: document.querySelector("#translatedRows"),
  passed: document.querySelector("#passedRows"),
  failed: document.querySelector("#failedRows")
};

let originalHeaders = [];
let originalRows = [];
let localizedRows = [];
let selectedRange = "1-4";

fileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  const parsed = parseCsv(await file.text());
  originalHeaders = parsed.headers;
  originalRows = parsed.rows;
  localizedRows = [];

  translateButton.disabled = parsed.rows.length === 0;
  downloadButton.disabled = true;
  fileStatus.textContent = `${file.name} / ${parsed.rows.length} rows`;
  renderRows(originalRows);
  updateMetrics(summarizeRows(originalRows));
});

translateButton.addEventListener("click", () => {
  localizedRows = localizeRows(originalRows, { range: selectedRange });
  downloadButton.disabled = localizedRows.every((row) => !row.translation_ko);
  renderRows(localizedRows);
  updateMetrics(summarizeRows(localizedRows));
});

downloadButton.addEventListener("click", () => {
  const headers = [
    ...originalHeaders,
    "translation_ko",
    "naturalness_score",
    "translationese_risk",
    "preserved_tokens",
    "validation_status",
    "validation_errors"
  ];
  const csv = toCsv(localizedRows, headers);
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `game-localization-results-difficulty-${selectedRange}.csv`;
  link.click();
  URL.revokeObjectURL(url);
});

rangeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedRange = button.dataset.range;
    rangeButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderRows(localizedRows.length > 0 ? localizedRows : originalRows);
  });
});

function renderRows(rows) {
  const visibleRows = rows.filter((row) => isInRange(row, selectedRange));

  if (visibleRows.length === 0) {
    rowsBody.innerHTML = '<tr><td colspan="5" class="empty">표시할 행이 없습니다.</td></tr>';
    return;
  }

  rowsBody.replaceChildren(
    ...visibleRows.map((row) => {
      const tr = document.createElement("tr");
      tr.append(
        cell(row.difficulty),
        cell(row.key),
        cell(row.source_en),
        cell(row.translation_ko || ""),
        validationCell(row)
      );
      return tr;
    })
  );
}

function validationCell(row) {
  const td = document.createElement("td");
  if (!row.validation_status) {
    return td;
  }

  const badge = document.createElement("span");
  badge.className = `badge ${row.validation_status === "pass" ? "ok" : "bad"}`;
  badge.textContent = row.validation_status;
  td.append(badge);

  if (row.validation_errors) {
    const errors = document.createElement("div");
    errors.className = "errors";
    errors.textContent = row.validation_errors;
    td.append(errors);
  }

  return td;
}

function cell(value) {
  const td = document.createElement("td");
  td.textContent = value ?? "";
  return td;
}

function updateMetrics(summary) {
  metrics.total.textContent = summary.total;
  metrics.translated.textContent = summary.translated;
  metrics.passed.textContent = summary.passed;
  metrics.failed.textContent = summary.failed;
}
