package com.ashelabs.turing.api.device.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.util.Map;
import java.util.UUID;

/**
 * Request DTO for device registration.
 * Validates device registration parameters.
 */
public record RegisterDeviceRequest(
    @NotNull(message = "Room ID is required")
    UUID roomId,

    @NotBlank(message = "Device type is required")
    String deviceType,

    @NotBlank(message = "Device identifier is required")
    @Pattern(
        regexp = "^[a-z0-9_-]+$",
        message = "Device identifier must be lowercase alphanumeric with hyphens or underscores"
    )
    String deviceIdentifier,

    String manufacturer,

    String model,

    Map<String, Object> metadata
) {}
