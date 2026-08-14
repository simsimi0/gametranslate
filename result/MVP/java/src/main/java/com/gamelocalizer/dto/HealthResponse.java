package com.gamelocalizer.dto;

public record HealthResponse(String status, String translator, String model, boolean apiKeyConfigured) {}
