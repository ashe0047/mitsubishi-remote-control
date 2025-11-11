package com.ashelabs.turing.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RoomInfo {
    private String id;
    private String name;
    private boolean online;
    private AirConState state;
    private AirConSettings settings;
}