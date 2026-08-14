package com.gamelocalizer.controller;

import com.gamelocalizer.dto.ApiError;
import com.gamelocalizer.service.MissingApiKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
  @ExceptionHandler(MissingApiKeyException.class)
  ResponseEntity<ApiError> missingApiKey(MissingApiKeyException error) {
    return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
        .body(new ApiError("missing_api_key", error.getMessage()));
  }

  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<ApiError> badRequest(IllegalArgumentException error) {
    return ResponseEntity.badRequest().body(new ApiError("bad_request", error.getMessage()));
  }
}
