package com.gamelocalizer;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

public final class CsvLocalizerCli {
  private CsvLocalizerCli() {}

  public static void main(String[] args) throws Exception {
    if (args.length < 2) {
      System.err.println("Usage: java com.gamelocalizer.CsvLocalizerCli <input.csv> <output.csv> [range]");
      System.exit(2);
    }

    GeminiTranslator translator;
    try {
      translator = GeminiTranslator.fromEnvironment();
    } catch (RuntimeException error) {
      System.err.println(error.getMessage());
      System.exit(1);
      return;
    }

    Path input = Path.of(args[0]).toAbsolutePath().normalize();
    Path output = Path.of(args[1]).toAbsolutePath().normalize();
    String range = args.length >= 3 ? args[2] : "all";

    CsvLocalizer.CsvTable table = CsvLocalizer.parseCsv(Files.readString(input, StandardCharsets.UTF_8));
    List<Map<String, String>> localized =
        CsvLocalizer.localizeRows(table.rows(), translator, range, input.getFileName().toString());

    if (output.getParent() != null) {
      Files.createDirectories(output.getParent());
    }
    Files.writeString(
        output,
        CsvLocalizer.toCsvWithBom(localized, table.headers()),
        StandardCharsets.UTF_8);

    System.out.println(localized.size() + " rows written to " + output);
  }
}
