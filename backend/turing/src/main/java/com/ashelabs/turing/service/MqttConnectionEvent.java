package com.ashelabs.turing.service;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class MqttConnectionEvent extends ApplicationEvent {
    private final boolean connected;

    public MqttConnectionEvent(Object source, boolean connected) {
        super(source);
        this.connected = connected;
    }
}