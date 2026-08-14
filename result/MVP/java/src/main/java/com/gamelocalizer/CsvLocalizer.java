package com.gamelocalizer;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class CsvLocalizer {
  public static final String UTF8_BOM = "\uFEFF";

  private static final List<String> RESULT_FIELDS =
      List.of(
          "translation_ko",
          "naturalness_score",
          "translationese_risk",
          "preserved_tokens",
          "validation_status",
          "validation_errors");

  private static final List<String> METADATA_FIELDS =
      List.of("translator_type", "model", "generated_at", "source_file", "row_count", "api_key_used");

  private static final Map<String, String> GLOSSARY =
      Map.of("Ashen Keep", "\uC7BF\uBE5B \uC131\uCC44");

  private static final List<Pattern> TOKEN_PATTERNS =
      List.of(
          Pattern.compile("\\\\[A-Za-z]\\[[^\\]]+\\]"),
          Pattern.compile("\\{[^{}\\s]+\\}"),
          Pattern.compile("%(?:\\d+\\$)?[-+0#]*(?:\\d+|\\*)?(?:\\.\\d+|\\.\\*)?[bcdeEfFgGosxXdiu]"),
          Pattern.compile("%%"),
          Pattern.compile("\\\\[nt]"),
          Pattern.compile("</?[A-Za-z][^>]*>"),
          Pattern.compile("\\[/?[A-Za-z][^\\]]*\\]"),
          Pattern.compile("[+-]?\\d+(?:\\.\\d+)?%"));

  private CsvLocalizer() {}

  public static CsvTable parseCsv(String text) {
    String input = text.startsWith(UTF8_BOM) ? text.substring(1) : text;
    List<List<String>> records = new ArrayList<>();
    List<String> row = new ArrayList<>();
    StringBuilder field = new StringBuilder();
    boolean inQuotes = false;

    for (int i = 0; i < input.length(); i += 1) {
      char current = input.charAt(i);
      char next = i + 1 < input.length() ? input.charAt(i + 1) : '\0';

      if (current == '"') {
        if (inQuotes && next == '"') {
          field.append('"');
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (current == ',' && !inQuotes) {
        row.add(field.toString());
        field.setLength(0);
        continue;
      }

      if ((current == '\n' || current == '\r') && !inQuotes) {
        if (current == '\r' && next == '\n') {
          i += 1;
        }
        row.add(field.toString());
        if (row.stream().anyMatch(value -> !value.isEmpty())) {
          records.add(row);
        }
        row = new ArrayList<>();
        field.setLength(0);
        continue;
      }

      field.append(current);
    }

    row.add(field.toString());
    if (row.stream().anyMatch(value -> !value.isEmpty())) {
      records.add(row);
    }
    if (records.isEmpty()) {
      return new CsvTable(List.of(), List.of());
    }

    List<String> headers = records.get(0).stream().map(String::trim).toList();
    List<Map<String, String>> rows = new ArrayList<>();
    for (List<String> values : records.subList(1, records.size())) {
      Map<String, String> item = new LinkedHashMap<>();
      for (int i = 0; i < headers.size(); i += 1) {
        item.put(headers.get(i), i < values.size() ? values.get(i) : "");
      }
      rows.add(item);
    }
    return new CsvTable(headers, rows);
  }

  public static String toCsvWithBom(List<Map<String, String>> rows, List<String> preferredHeaders) {
    return UTF8_BOM + toCsv(rows, preferredHeaders);
  }

  public static String toCsv(List<Map<String, String>> rows, List<String> preferredHeaders) {
    List<String> headers = resultHeaders(preferredHeaders, rows);
    List<String> lines = new ArrayList<>();
    lines.add(headers.stream().map(CsvLocalizer::escapeCsvField).reduce((a, b) -> a + "," + b).orElse(""));
    for (Map<String, String> row : rows) {
      List<String> fields = new ArrayList<>();
      for (String header : headers) {
        fields.add(escapeCsvField(row.getOrDefault(header, "")));
      }
      lines.add(String.join(",", fields));
    }
    return String.join("\r\n", lines);
  }

  public static List<Map<String, String>> localizeRows(
      List<Map<String, String>> rows, Translator translator, String range, String sourceFile) {
    if (translator == null) {
      throw new IllegalArgumentException("translator is required");
    }

    List<Map<String, String>> targets =
        rows.stream().filter(row -> inRange(row, range == null ? "all" : range)).toList();
    String generatedAt = Instant.now().toString();
    List<Map<String, String>> localized = new ArrayList<>();

    if (translator.supportsBatch()) {
      List<TranslationAttempt> translations = translateBatch(targets, translator);
      for (int i = 0; i < targets.size(); i += 1) {
        localized.add(localizeRow(targets.get(i), translator, generatedAt, sourceFile, targets.size(), translations.get(i)));
      }
      return localized;
    }

    for (Map<String, String> row : targets) {
      localized.add(localizeRow(row, translator, generatedAt, sourceFile, targets.size(), null));
    }

    return localized;
  }

  public static List<String> resultHeaders(List<String> inputHeaders, List<Map<String, String>> rows) {
    Set<String> headers = new LinkedHashSet<>(inputHeaders);
    headers.addAll(RESULT_FIELDS);
    headers.addAll(METADATA_FIELDS);
    for (Map<String, String> row : rows) {
      headers.addAll(row.keySet());
    }
    return new ArrayList<>(headers);
  }

  public static List<String> expectedRequiredTokens(Map<String, String> row) {
    List<String> tokens = requiredTokens(row);
    return tokens.stream().map(token -> GLOSSARY.getOrDefault(token, token)).toList();
  }

  private static Map<String, String> localizeRow(
      Map<String, String> row,
      Translator translator,
      String generatedAt,
      String sourceFile,
      int rowCount,
      TranslationAttempt attempt) {
    Map<String, String> result = new LinkedHashMap<>(row);
    String translatorError = "";
    TranslationResult translation;

    if (attempt != null) {
      translation = attempt.result();
      translatorError = attempt.error();
    } else {
      try {
        translation = translator.translate(row);
      } catch (Exception error) {
        translation = new TranslationResult("", "", "high");
        translatorError = error.getMessage() == null ? error.toString() : error.getMessage();
      }
    }

    result.put("translation_ko", translation.translationKo());
    result.put("naturalness_score", translation.naturalnessScore());
    result.put("translationese_risk", translation.translationeseRisk());
    result.put("translator_type", translator.translatorType());
    result.put("model", translator.model());
    result.put("generated_at", generatedAt);
    result.put("source_file", sourceFile == null ? "" : sourceFile);
    result.put("row_count", String.valueOf(rowCount));
    result.put("api_key_used", String.valueOf(translator.apiKeyUsed()));

    Validation validation = validateRow(row, result);
    if (!translatorError.isEmpty()) {
      validation = validation.withError("translator error: " + translatorError);
    }
    result.put("preserved_tokens", String.join(" ", validation.preservedTokens()));
    result.put("validation_status", validation.errors().isEmpty() ? "pass" : "fail");
    result.put("validation_errors", String.join("; ", validation.errors()));
    return result;
  }

  private static List<TranslationAttempt> translateBatch(List<Map<String, String>> targets, Translator translator) {
    try {
      List<TranslationResult> results = translator.translateAll(targets);
      if (results.size() != targets.size()) {
        throw new IllegalStateException(
            "translator returned " + results.size() + " rows for " + targets.size() + " input rows");
      }
      List<TranslationAttempt> attempts = new ArrayList<>();
      for (TranslationResult result : results) {
        attempts.add(new TranslationAttempt(result, ""));
      }
      return attempts;
    } catch (Exception error) {
      String message = error.getMessage() == null ? error.toString() : error.getMessage();
      List<TranslationAttempt> attempts = new ArrayList<>();
      for (int i = 0; i < targets.size(); i += 1) {
        attempts.add(new TranslationAttempt(new TranslationResult("", "", "high"), message));
      }
      return attempts;
    }
  }

  private static Validation validateRow(Map<String, String> sourceRow, Map<String, String> resultRow) {
    List<String> errors = new ArrayList<>();
    List<String> preserved = new ArrayList<>();

    if (!sourceRow.getOrDefault("key", "").equals(resultRow.getOrDefault("key", ""))) {
      errors.add("key changed");
    }
    if (resultRow.getOrDefault("translation_ko", "").isEmpty()) {
      errors.add("missing translation");
    }

    for (String token : expectedRequiredTokens(sourceRow)) {
      if (resultRow.getOrDefault("translation_ko", "").contains(token)) {
        preserved.add(token);
      } else {
        errors.add("missing token: " + token);
      }
    }

    return new Validation(preserved, errors);
  }

  private static List<String> requiredTokens(Map<String, String> row) {
    Set<String> tokens = new LinkedHashSet<>();
    tokens.addAll(extractPatternTokens(row.getOrDefault("source_en", "")));
    tokens.addAll(extractPatternTokens(row.getOrDefault("required_preserve", "")));
    tokens.addAll(extractLiteralPreserveTokens(row.getOrDefault("required_preserve", "")));
    tokens.remove("");
    return new ArrayList<>(tokens);
  }

  private static List<String> extractPatternTokens(String text) {
    Set<String> tokens = new LinkedHashSet<>();
    for (Pattern pattern : TOKEN_PATTERNS) {
      Matcher matcher = pattern.matcher(text == null ? "" : text);
      while (matcher.find()) {
        tokens.add(matcher.group());
      }
    }
    return new ArrayList<>(tokens);
  }

  private static List<String> extractLiteralPreserveTokens(String text) {
    String remainder = text == null ? "" : text.trim();
    if (remainder.isEmpty()) {
      return List.of();
    }
    for (String token : extractPatternTokens(remainder)) {
      remainder = remainder.replace(token, " ");
    }
    String literal = remainder.replaceAll("\\s+", " ").trim();
    return literal.isEmpty() ? List.of() : List.of(literal);
  }

  private static boolean inRange(Map<String, String> row, String range) {
    if ("all".equals(range)) {
      return true;
    }
    String[] parts = range.split("-", 2);
    if (parts.length != 2) {
      throw new IllegalArgumentException("range must be all or min-max");
    }
    int difficulty = Integer.parseInt(row.getOrDefault("difficulty", "0"));
    return difficulty >= Integer.parseInt(parts[0]) && difficulty <= Integer.parseInt(parts[1]);
  }

  private static String escapeCsvField(String value) {
    String text = value == null ? "" : value;
    if (text.indexOf('"') >= 0 || text.indexOf(',') >= 0 || text.indexOf('\n') >= 0 || text.indexOf('\r') >= 0) {
      return "\"" + text.replace("\"", "\"\"") + "\"";
    }
    return text;
  }

  public record CsvTable(List<String> headers, List<Map<String, String>> rows) {}

  private record Validation(List<String> preservedTokens, List<String> errors) {
    Validation withError(String error) {
      List<String> next = new ArrayList<>(errors);
      next.add(error);
      return new Validation(preservedTokens, next);
    }
  }

  private record TranslationAttempt(TranslationResult result, String error) {}
}
