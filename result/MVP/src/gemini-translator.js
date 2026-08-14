import { expectedRequiredTokensForRow } from "./localizer.js";

export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";
const DEFAULT_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const RESPONSE_SCHEMA = {
  type: "object",
  required: ["translation_ko", "naturalness_score", "translationese_risk"],
  properties: {
    translation_ko: { type: "string" },
    naturalness_score: { type: "integer" },
    translationese_risk: { type: "string", enum: ["low", "medium", "high"] }
  }
};

export class GeminiTranslator {
  #apiKey;

  constructor({ apiKey, model = DEFAULT_GEMINI_MODEL, endpointBase = DEFAULT_ENDPOINT_BASE, fetchImpl = globalThis.fetch } = {}) {
    this.#apiKey = apiKey;
    this.model = model;
    this.endpointBase = endpointBase;
    this.fetchImpl = fetchImpl;
    this.translatorType = "gemini";
  }

  static fromEnv(env = readProcessEnv()) {
    const apiKey = String(env.GOOGLE_API_KEY ?? env.GEMINI_API_KEY ?? "").trim();
    const model = String(env.GEMINI_MODEL ?? "").trim() || DEFAULT_GEMINI_MODEL;

    if (!apiKey) {
      throw new Error("GOOGLE_API_KEY or GEMINI_API_KEY is required for Gemini translation");
    }

    return new GeminiTranslator({ apiKey, model });
  }

  get apiKeyUsed() {
    return Boolean(this.#apiKey);
  }

  async translate(row) {
    if (!this.#apiKey) {
      throw new Error("GOOGLE_API_KEY or GEMINI_API_KEY is required for Gemini translation");
    }
    if (typeof this.fetchImpl !== "function") {
      throw new Error("fetch is not available");
    }

    const response = await this.fetchImpl(this.endpoint(), {
      method: "POST",
      headers: {
        "x-goog-api-key": this.#apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: buildPrompt(row)
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA
        }
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error?.message ?? `Gemini request failed: ${response.status}`);
    }

    return parseTranslationResponse(data);
  }

  endpoint() {
    return `${this.endpointBase}/${encodeURIComponent(this.model)}:generateContent`;
  }
}

function buildPrompt(row) {
  return JSON.stringify({
    task: "Translate the source_en field to Korean for an indie game localization CSV.",
    rules: [
      "Use source_en as the text to translate.",
      "Use category, speaker, context, and style_guide only as references.",
      "Preserve every required token exactly.",
      "Do not translate or change key.",
      "Return JSON only."
    ],
    row: {
      key: row.key ?? "",
      category: row.category ?? "",
      speaker: row.speaker ?? "",
      context: row.context ?? "",
      source_en: row.source_en ?? "",
      style_guide: row.style_guide ?? "",
      required_preserve: row.required_preserve ?? "",
      required_tokens: expectedRequiredTokensForRow(row)
    },
    output_schema: RESPONSE_SCHEMA
  });
}

function parseTranslationResponse(data) {
  const text = collectCandidateText(data);
  if (!text) {
    throw new Error("Gemini response did not include candidate text");
  }

  const parsed = JSON.parse(text);
  return {
    translation_ko: parsed.translation_ko ?? "",
    naturalness_score: parsed.naturalness_score ?? "",
    translationese_risk: parsed.translationese_risk ?? ""
  };
}

function collectCandidateText(data) {
  return (data.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .filter(Boolean)
    .join("\n");
}

function readProcessEnv() {
  if (typeof process === "undefined" || !process.env) {
    throw new Error("process.env is not available. Gemini translation must run outside browser JavaScript.");
  }
  return process.env;
}
