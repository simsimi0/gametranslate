import { isInRange, parseCsv, resultHeaders, summarizeRows, toCsvWithBom } from "./localizer.js";

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
let localizedHeaders = [];
let localizedRows = [];
let selectedFile = null;
let selectedRange = "1-4";

fileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  const parsed = parseCsv(await file.text());
  selectedFile = file;
  originalHeaders = parsed.headers;
  originalRows = parsed.rows;
  localizedHeaders = [];
  localizedRows = [];

  translateButton.disabled = parsed.rows.length === 0;
  downloadButton.disabled = parsed.rows.every((row) => !row.translation_ko);
  fileStatus.textContent = `${file.name} / ${parsed.rows.length} rows`;
  renderRows(originalRows);
  updateMetrics(summarizeRows(originalRows));
});

translateButton.addEventListener("click", async () => {
  if (!selectedFile) {
    return;
  }

  translateButton.disabled = true;
  downloadButton.disabled = true;
  fileStatus.textContent = "Translating...";

  try {
    const formData = new FormData();
    formData.append("file", selectedFile);
    const response = await fetch(`/api/localize/csv?range=${encodeURIComponent(selectedRange)}`, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      throw new Error(await responseMessage(response));
    }

    const csvText = await response.text();
    const parsed = parseCsv(csvText);
    localizedHeaders = parsed.headers;
    localizedRows = parsed.rows;
    downloadButton.disabled = localizedRows.length === 0;
    fileStatus.textContent = `${localizedRows.length} rows translated`;
    renderRows(localizedRows);
    updateMetrics(summarizeRows(localizedRows));
  } catch (error) {
    localizedHeaders = [];
    localizedRows = [];
    fileStatus.textContent = error instanceof Error ? error.message : String(error);
    renderRows(originalRows);
    updateMetrics(summarizeRows(originalRows));
  } finally {
    translateButton.disabled = originalRows.length === 0;
  }
});

downloadButton.addEventListener("click", () => {
  const rows = localizedRows.length > 0 ? localizedRows : originalRows.filter((row) => isInRange(row, selectedRange));
  const headers = localizedRows.length > 0 ? localizedHeaders : resultHeaders(originalHeaders);
  const csv = toCsvWithBom(rows, headers);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
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
    localizedHeaders = [];
    localizedRows = [];
    downloadButton.disabled = originalRows.every((row) => !row.translation_ko);
    renderRows(originalRows);
  });
});

function renderRows(rows) {
  const visibleRows = rows.filter((row) => isInRange(row, selectedRange));

  if (visibleRows.length === 0) {
    rowsBody.innerHTML = '<tr><td colspan="5" class="empty">No rows to show.</td></tr>';
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

async function responseMessage(response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = await response.json();
    return payload.message ?? `Request failed: ${response.status}`;
  }
  return (await response.text()) || `Request failed: ${response.status}`;
}
