package com.gamelocalizer.service;

public class MissingApiKeyException extends RuntimeException {
  public MissingApiKeyException(String message) {
    super(message);
  }
}
