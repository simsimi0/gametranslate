import { expectedRequiredTokensForRow } from "./localizer.js";

const DEFAULT_MODEL = "gpt-4.1-mini";
const DEFAULT_ENDPOINT = "https://api.openai.com/v1/responses";

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["translation_ko", "naturalness_score", "translationese_risk"],
  properties: {
    translation_ko: { type: "string" },
    naturalness_score: { type: "integer", minimum: 1, maximum: 10 },
    translationese_risk: { type: "string", enum: ["low", "medium", "high"] }
  }
};

export class OpenAITranslator {
  constructor({ apiKey, model = DEFAULT_MODEL, endpoint = DEFAULT_ENDPOINT, fetchImpl = globalThis.fetch } = {}) {
    this.apiKey = apiKey;
    this.model = model;
    this.endpoint = endpoint;
    this.fetchImpl = fetchImpl;
  }

  async translate(row) {
    if (!this.apiKey) {
      throw new Error("OpenAI API key is required");
    }
    if (typeof this.fetchImpl !== "function") {
      throw new Error("fetch is not available");
    }

    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  "You are a professional English-to-Korean indie game localizer. Produce natural Korean, preserve required format tokens exactly, and return JSON only."
              }
            ]
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify(buildTranslationPayload(row))
              }
            ]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "game_localization_result",
            schema: RESPONSE_SCHEMA,
            strict: true
          }
        }
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error?.message ?? `OpenAI request failed: ${response.status}`);
    }

    return parseTranslationResponse(data);
  }
}

function buildTranslationPayload(row) {
  return {
    task: "Translate the source text to Korean for an indie game localization CSV.",
    rules: [
      "Use source_en as the text to translate.",
      "Use category, speaker, context, and style_guide only as references.",
      "Preserve every required token exactly.",
      "Do not translate or change key."
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
  };
}

function parseTranslationResponse(data) {
  const text = data.output_text ?? collectOutputText(data);
  if (!text) {
    throw new Error("OpenAI response did not include output text");
  }

  const parsed = JSON.parse(text);
  return {
    translation_ko: parsed.translation_ko ?? "",
    naturalness_score: parsed.naturalness_score ?? "",
    translationese_risk: parsed.translationese_risk ?? ""
  };
}

function collectOutputText(data) {
  return (data.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .filter(Boolean)
    .join("\n");
}
