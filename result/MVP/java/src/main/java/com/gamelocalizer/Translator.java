package com.gamelocalizer;

import java.util.Map;
import java.util.ArrayList;
import java.util.List;

public interface Translator {
  TranslationResult translate(Map<String, String> row) throws Exception;

  default boolean supportsBatch() {
    return false;
  }

  default List<TranslationResult> translateAll(List<Map<String, String>> rows) throws Exception {
    List<TranslationResult> results = new ArrayList<>();
    for (Map<String, String> row : rows) {
      results.add(translate(row));
    }
    return results;
  }

  default String translatorType() {
    return "unknown";
  }

  default String model() {
    return "";
  }

  default boolean apiKeyUsed() {
    return false;
  }
}
