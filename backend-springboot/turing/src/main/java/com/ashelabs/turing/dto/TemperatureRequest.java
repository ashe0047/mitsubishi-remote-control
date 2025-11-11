package com.ashelabs.turing.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TemperatureRequest {
    private String roomId;
    private Integer temperature;
}