package com.ashelabs.turing.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import jakarta.validation.Valid;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SettingsRequest {
    private String roomId;
    
    @Valid
    private AirConSettings settings;
}