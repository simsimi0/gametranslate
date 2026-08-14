package com.gamelocalizer;

import java.util.Map;

public interface Translator {
  TranslationResult translate(Map<String, String> row) throws Exception;

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
