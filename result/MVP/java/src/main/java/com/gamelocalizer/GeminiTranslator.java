package com.gamelocalizer;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class GeminiTranslator implements Translator {
  public static final String DEFAULT_MODEL = "gemini-3.6-flash";
  private static final String DEFAULT_ENDPOINT_BASE =
      "https://generativelanguage.googleapis.com/v1beta/models";

  private final String apiKey;
  private final String model;
  private final String endpointBase;
  private final HttpTransport transport;

  public GeminiTranslator(String apiKey, String model, HttpTransport transport) {
    this(apiKey, model, DEFAULT_ENDPOINT_BASE, transport);
  }

  public GeminiTranslator(String apiKey, String model, String endpointBase, HttpTransport transport) {
    this.apiKey = apiKey == null ? "" : apiKey.trim();
    this.model = isBlank(model) ? DEFAULT_MODEL : model.trim();
    this.endpointBase = isBlank(endpointBase) ? DEFAULT_ENDPOINT_BASE : endpointBase.trim();
    this.transport = transport == null ? new JavaHttpTransport() : transport;
  }

  public static GeminiTranslator fromEnvironment() {
    return fromEnvironment(System.getenv());
  }

  public static GeminiTranslator fromEnvironment(Map<String, String> env) {
    String apiKey = trim(firstPresent(env, "GOOGLE_API_KEY", "GEMINI_API_KEY"));
    String model = trim(env.get("GEMINI_MODEL"));
    if (apiKey.isEmpty()) {
      throw new IllegalStateException("GOOGLE_API_KEY or GEMINI_API_KEY is required for Gemini translation.");
    }
    return new GeminiTranslator(apiKey, model.isEmpty() ? DEFAULT_MODEL : model, new JavaHttpTransport());
  }

  @Override
  public TranslationResult translate(Map<String, String> row) throws Exception {
    if (apiKey.isEmpty()) {
      throw new IllegalStateException("GOOGLE_API_KEY or GEMINI_API_KEY is required for Gemini translation.");
    }

    HttpResponseData response =
        transport.postJson(
            endpoint(),
            Map.of(
                "x-goog-api-key", apiKey,
                "Content-Type", "application/json"),
            buildRequestBody(row));

    if (response.statusCode() < 200 || response.statusCode() >= 300) {
      String message = extractJsonString(response.body(), "message");
      throw new IOException(
          message.isEmpty()
              ? "Gemini request failed: HTTP " + response.statusCode()
              : "Gemini request failed: " + message);
    }

    String outputText = String.join("\n", extractAllJsonStrings(response.body(), "text"));
    if (outputText.isEmpty()) {
      throw new IOException("Gemini response did not include candidate text.");
    }

    String translation = extractJsonString(outputText, "translation_ko");
    String risk = extractJsonString(outputText, "translationese_risk");
    String score = extractJsonScalar(outputText, "naturalness_score");
    return new TranslationResult(translation, score, risk);
  }

  @Override
  public String translatorType() {
    return "gemini";
  }

  @Override
  public String model() {
    return model;
  }

  @Override
  public boolean apiKeyUsed() {
    return !apiKey.isEmpty();
  }

  URI endpoint() {
    return URI.create(
        endpointBase
            + "/"
            + URLEncoder.encode(model, StandardCharsets.UTF_8)
            + ":generateContent");
  }

  private String buildRequestBody(Map<String, String> row) {
    return "{"
        + "\"contents\":[{\"role\":\"user\",\"parts\":[{\"text\":"
        + jsonString(buildPayload(row))
        + "}]}],"
        + "\"generationConfig\":{"
        + "\"responseMimeType\":\"application/json\","
        + "\"responseSchema\":"
        + responseSchema()
        + "}}";
  }

  private String buildPayload(Map<String, String> row) {
    Map<String, String> fields = new LinkedHashMap<>();
    fields.put("key", row.getOrDefault("key", ""));
    fields.put("category", row.getOrDefault("category", ""));
    fields.put("speaker", row.getOrDefault("speaker", ""));
    fields.put("context", row.getOrDefault("context", ""));
    fields.put("source_en", row.getOrDefault("source_en", ""));
    fields.put("style_guide", row.getOrDefault("style_guide", ""));
    fields.put("required_preserve", row.getOrDefault("required_preserve", ""));

    StringBuilder json = new StringBuilder("{\"task\":\"translate_source_en_to_korean\",\"rules\":[");
    json.append(jsonString("Use source_en as the text to translate.")).append(',');
    json.append(jsonString("Use metadata only as context.")).append(',');
    json.append(jsonString("Preserve required tokens exactly.")).append(',');
    json.append(jsonString("Return JSON only."));
    json.append("],\"row\":{");
    boolean first = true;
    for (Map.Entry<String, String> entry : fields.entrySet()) {
      if (!first) {
        json.append(',');
      }
      first = false;
      json.append(jsonString(entry.getKey())).append(':').append(jsonString(entry.getValue()));
    }
    json.append("},\"required_tokens\":[");
    List<String> tokens = CsvLocalizer.expectedRequiredTokens(row);
    for (int i = 0; i < tokens.size(); i += 1) {
      if (i > 0) {
        json.append(',');
      }
      json.append(jsonString(tokens.get(i)));
    }
    json.append("]}");
    return json.toString();
  }

  private static String responseSchema() {
    return "{"
        + "\"type\":\"object\","
        + "\"required\":[\"translation_ko\",\"naturalness_score\",\"translationese_risk\"],"
        + "\"properties\":{"
        + "\"translation_ko\":{\"type\":\"string\"},"
        + "\"naturalness_score\":{\"type\":\"integer\"},"
        + "\"translationese_risk\":{\"type\":\"string\",\"enum\":[\"low\",\"medium\",\"high\"]}"
        + "}}";
  }

  static String extractJsonString(String json, String fieldName) {
    if (json == null || fieldName == null) {
      return "";
    }
    String needle = "\"" + fieldName + "\"";
    int searchFrom = 0;
    while (searchFrom < json.length()) {
      int key = json.indexOf(needle, searchFrom);
      if (key < 0) {
        return "";
      }
      int colon = json.indexOf(':', key + needle.length());
      if (colon < 0) {
        return "";
      }
      int valueStart = skipWhitespace(json, colon + 1);
      if (valueStart < json.length() && json.charAt(valueStart) == '"') {
        return readJsonString(json, valueStart);
      }
      searchFrom = colon + 1;
    }
    return "";
  }

  static List<String> extractAllJsonStrings(String json, String fieldName) {
    List<String> values = new ArrayList<>();
    if (json == null || fieldName == null) {
      return values;
    }
    String needle = "\"" + fieldName + "\"";
    int searchFrom = 0;
    while (searchFrom < json.length()) {
      int key = json.indexOf(needle, searchFrom);
      if (key < 0) {
        break;
      }
      int colon = json.indexOf(':', key + needle.length());
      if (colon < 0) {
        break;
      }
      int valueStart = skipWhitespace(json, colon + 1);
      if (valueStart < json.length() && json.charAt(valueStart) == '"') {
        values.add(readJsonString(json, valueStart));
        searchFrom = valueStart + 1;
      } else {
        searchFrom = colon + 1;
      }
    }
    return values;
  }

  static String extractJsonScalar(String json, String fieldName) {
    if (json == null || fieldName == null) {
      return "";
    }
    String needle = "\"" + fieldName + "\"";
    int key = json.indexOf(needle);
    if (key < 0) {
      return "";
    }
    int colon = json.indexOf(':', key + needle.length());
    if (colon < 0) {
      return "";
    }
    int start = skipWhitespace(json, colon + 1);
    if (start < json.length() && json.charAt(start) == '"') {
      return readJsonString(json, start);
    }
    int end = start;
    while (end < json.length() && ",}\r\n\t ".indexOf(json.charAt(end)) < 0) {
      end += 1;
    }
    return json.substring(start, end);
  }

  static String jsonString(String value) {
    StringBuilder json = new StringBuilder("\"");
    for (int i = 0; i < value.length(); i += 1) {
      char current = value.charAt(i);
      switch (current) {
        case '"':
          json.append("\\\"");
          break;
        case '\\':
          json.append("\\\\");
          break;
        case '\b':
          json.append("\\b");
          break;
        case '\f':
          json.append("\\f");
          break;
        case '\n':
          json.append("\\n");
          break;
        case '\r':
          json.append("\\r");
          break;
        case '\t':
          json.append("\\t");
          break;
        default:
          if (current < 0x20) {
            json.append(String.format("\\u%04x", (int) current));
          } else {
            json.append(current);
          }
      }
    }
    json.append('"');
    return json.toString();
  }

  private static String readJsonString(String json, int quoteIndex) {
    StringBuilder value = new StringBuilder();
    for (int i = quoteIndex + 1; i < json.length(); i += 1) {
      char current = json.charAt(i);
      if (current == '"') {
        return value.toString();
      }
      if (current != '\\') {
        value.append(current);
        continue;
      }
      if (i + 1 >= json.length()) {
        break;
      }
      char escaped = json.charAt(++i);
      switch (escaped) {
        case '"':
        case '\\':
        case '/':
          value.append(escaped);
          break;
        case 'b':
          value.append('\b');
          break;
        case 'f':
          value.append('\f');
          break;
        case 'n':
          value.append('\n');
          break;
        case 'r':
          value.append('\r');
          break;
        case 't':
          value.append('\t');
          break;
        case 'u':
          if (i + 4 < json.length()) {
            value.append((char) Integer.parseInt(json.substring(i + 1, i + 5), 16));
            i += 4;
          }
          break;
        default:
          value.append(escaped);
      }
    }
    return value.toString();
  }

  private static int skipWhitespace(String text, int index) {
    int cursor = index;
    while (cursor < text.length() && Character.isWhitespace(text.charAt(cursor))) {
      cursor += 1;
    }
    return cursor;
  }

  private static String firstPresent(Map<String, String> values, String first, String second) {
    String firstValue = values.get(first);
    return firstValue == null || firstValue.isBlank() ? values.get(second) : firstValue;
  }

  private static String trim(String value) {
    return value == null ? "" : value.trim();
  }

  private static boolean isBlank(String value) {
    return value == null || value.trim().isEmpty();
  }

  public interface HttpTransport {
    HttpResponseData postJson(URI endpoint, Map<String, String> headers, String body)
        throws IOException, InterruptedException;
  }

  public record HttpResponseData(int statusCode, String body) {}

  private static final class JavaHttpTransport implements HttpTransport {
    private final HttpClient client =
        HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();

    @Override
    public HttpResponseData postJson(URI endpoint, Map<String, String> headers, String body)
        throws IOException, InterruptedException {
      HttpRequest.Builder builder =
          HttpRequest.newBuilder(endpoint)
              .timeout(Duration.ofMinutes(2))
              .POST(HttpRequest.BodyPublishers.ofString(body));
      headers.forEach(builder::header);
      HttpResponse<String> response = client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
      return new HttpResponseData(response.statusCode(), response.body());
    }
  }
}
