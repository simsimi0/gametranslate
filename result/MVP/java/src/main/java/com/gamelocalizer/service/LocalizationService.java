package com.gamelocalizer.service;

import com.gamelocalizer.CsvLocalizer;
import com.gamelocalizer.Translator;
import com.gamelocalizer.dto.HealthResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class LocalizationService {
  private final Translator translator;

  public LocalizationService(Translator translator) {
    this.translator = translator;
  }

  public HealthResponse health() {
    return new HealthResponse("ok", translator.translatorType(), translator.model(), translator.apiKeyUsed());
  }

  public byte[] localizeCsv(MultipartFile file, String range) throws IOException {
    if (!translator.apiKeyUsed()) {
      throw new MissingApiKeyException(
          "GOOGLE_API_KEY or GEMINI_API_KEY is required on the server before translation can run.");
    }
    if (file == null || file.isEmpty()) {
      throw new IllegalArgumentException("CSV file is required.");
    }

    String sourceText = new String(file.getBytes(), StandardCharsets.UTF_8);
    CsvLocalizer.CsvTable table = CsvLocalizer.parseCsv(sourceText);
    if (!table.headers().contains("source_en")) {
      throw new IllegalArgumentException("CSV must include source_en column.");
    }

    List<Map<String, String>> localized =
        CsvLocalizer.localizeRows(table.rows(), translator, range, sourceFileName(file));
    return CsvLocalizer.toCsvWithBom(localized, table.headers()).getBytes(StandardCharsets.UTF_8);
  }

  private String sourceFileName(MultipartFile file) {
    String originalName = file.getOriginalFilename();
    return originalName == null ? "" : originalName;
  }
}
