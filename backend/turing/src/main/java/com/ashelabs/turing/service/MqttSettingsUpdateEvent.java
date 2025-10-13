package com.ashelabs.turing.service;

import com.ashelabs.turing.dto.AirConSettings;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class MqttSettingsUpdateEvent extends ApplicationEvent {
    private final String roomId;
    private final AirConSettings settings;

    public MqttSettingsUpdateEvent(Object source, String roomId, AirConSettings settings) {
        super(source);
        this.roomId = roomId;
        this.settings = settings;
    }
}