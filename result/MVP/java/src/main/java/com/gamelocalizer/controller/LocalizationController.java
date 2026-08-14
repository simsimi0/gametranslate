package com.gamelocalizer.controller;

import com.gamelocalizer.dto.HealthResponse;
import com.gamelocalizer.service.LocalizationService;
import java.io.IOException;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
public class LocalizationController {
  private final LocalizationService localizationService;

  public LocalizationController(LocalizationService localizationService) {
    this.localizationService = localizationService;
  }

  @GetMapping("/api/health")
  public HealthResponse health() {
    return localizationService.health();
  }

  @PostMapping(
      value = "/api/localize/csv",
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
      produces = "text/csv;charset=UTF-8")
  public ResponseEntity<byte[]> localizeCsv(
      @RequestPart("file") MultipartFile file,
      @RequestParam(defaultValue = "all") String range)
      throws IOException {
    byte[] csv = localizationService.localizeCsv(file, range);
    return ResponseEntity.ok()
        .header(
            HttpHeaders.CONTENT_DISPOSITION,
            ContentDisposition.attachment().filename(resultFileName(file, range)).build().toString())
        .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
        .body(csv);
  }

  private String resultFileName(MultipartFile file, String range) {
    String originalName = file.getOriginalFilename();
    String baseName = originalName == null || originalName.isBlank() ? "localization-results" : originalName;
    return baseName.replaceAll("\\.csv$", "") + "-translated-" + range + ".csv";
  }
}
