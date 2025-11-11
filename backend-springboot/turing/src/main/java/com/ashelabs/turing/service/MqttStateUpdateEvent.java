package com.ashelabs.turing.service;

import com.ashelabs.turing.dto.AirConState;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class MqttStateUpdateEvent extends ApplicationEvent {
    private final String roomId;
    private final AirConState state;

    public MqttStateUpdateEvent(Object source, String roomId, AirConState state) {
        super(source);
        this.roomId = roomId;
        this.state = state;
    }
}