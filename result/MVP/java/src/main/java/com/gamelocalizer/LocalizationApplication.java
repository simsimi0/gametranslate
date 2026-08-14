package com.gamelocalizer;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class LocalizationApplication {
  public static void main(String[] args) {
    SpringApplication.run(LocalizationApplication.class, args);
  }
}
