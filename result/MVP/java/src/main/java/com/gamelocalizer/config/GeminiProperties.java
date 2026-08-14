package com.gamelocalizer.config;

import com.gamelocalizer.GeminiTranslator;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "gemini")
public record GeminiProperties(String apiKey, String model) {
  public String apiKeyOrEmpty() {
    return apiKey == null ? "" : apiKey.trim();
  }

  public String modelOrDefault() {
    return model == null || model.isBlank() ? GeminiTranslator.DEFAULT_MODEL : model.trim();
  }
}
