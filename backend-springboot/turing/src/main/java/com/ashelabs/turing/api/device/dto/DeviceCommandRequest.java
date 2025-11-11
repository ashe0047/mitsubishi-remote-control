package com.ashelabs.turing.api.device.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Request DTO for device control commands.
 * Supports temperature, mode, fan speed, and power commands.
 */
public record DeviceCommandRequest(
    @NotBlank(message = "Device identifier is required")
    String deviceIdentifier,

    Integer temperature,

    String mode,

    String fanSpeed,

    Boolean power,

    String vanePosition,

    String wideVanePosition
) {}
