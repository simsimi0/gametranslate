package com.gamelocalizer;

public record TranslationResult(String translationKo, String naturalnessScore, String translationeseRisk) {
  public TranslationResult {
    translationKo = translationKo == null ? "" : translationKo.trim();
    naturalnessScore = naturalnessScore == null ? "" : naturalnessScore.trim();
    translationeseRisk = translationeseRisk == null ? "" : translationeseRisk.trim();
  }
}
