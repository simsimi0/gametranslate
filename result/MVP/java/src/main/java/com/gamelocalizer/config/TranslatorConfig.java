package com.gamelocalizer.config;

import com.gamelocalizer.GeminiTranslator;
import com.gamelocalizer.Translator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class TranslatorConfig {
  @Bean
  Translator translator(GeminiProperties properties) {
    return new GeminiTranslator(properties.apiKeyOrEmpty(), properties.modelOrDefault(), null);
  }
}
