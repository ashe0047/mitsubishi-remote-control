package com.ashelabs.turing.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AirConSettings {

    @NotNull
    @Pattern(regexp = "ON|OFF|on|off", 
             message = "Invalid power value")
    private String power;

    @NotNull
    @DecimalMin(value = "16", message = "Temperature must be at least 16")
    @DecimalMax(value = "31", message = "Temperature must be at most 31")
    private Double temperature;

    @NotNull
    @Pattern(regexp = "AUTO|1|2|3|4|QUIET|auto|low|middle|medium|high|diffuse", 
             message = "Invalid fan value")
    private String fan;

    @NotNull
    @Pattern(regexp = "AUTO|1|2|3|4|5|SWING", 
             message = "Invalid vane value")
    private String vane;

    @NotNull
    @Pattern(regexp = "<<|<|\\||>|>>|SWING", 
             message = "Invalid wide vane value")
    private String wideVane;

    @NotNull
    @Pattern(regexp = "off|heat_cool|cool|dry|heat|fan_only", 
             message = "Invalid mode value")
    private String mode;
}