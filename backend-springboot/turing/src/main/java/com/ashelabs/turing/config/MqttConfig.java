package com.ashelabs.turing.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;

@Configuration
@ConfigurationProperties(prefix = "mqtt")
@Data
@Validated
public class MqttConfig {

    @NotBlank(message = "MQTT broker URL is required")
    private String brokerUrl;

    @NotNull
    @Min(1)
    @Max(65535)
    private Integer brokerPort = 1883;

    @NotBlank(message = "MQTT username is required")
    private String username;

    @NotBlank(message = "MQTT password is required") 
    private String password;

    @NotBlank(message = "MQTT client ID is required")
    private String clientId = "turing-server";

    @NotNull
    @Min(10)
    private Integer keepAliveInterval = 60;

    @NotNull
    @Min(1)
    private Integer connectionTimeout = 30;

    @NotNull
    private Boolean cleanSession = true;

    @NotNull
    @Min(1)
    @Max(10)
    private Integer reconnectAttempts = 3;

    @NotNull
    @Min(1)
    private Integer reconnectDelay = 5000;

    // MQTT Topic Configuration
    @NotBlank(message = "Base MQTT topic is required")
    private String baseTopic = "mitsubishi2mqtt";

    public String getFullBrokerUrl() {
        return String.format("tcp://%s:%d", brokerUrl, brokerPort);
    }

    public String getStateTopicPattern() {
        return baseTopic + "/+/state";
    }

    public String getSettingsTopicPattern() {
        return baseTopic + "/+/settings";
    }

    public String getCommandTopic(String roomId, String command) {
        return String.format("%s/%s/%s/set", baseTopic, roomId, command);
    }
}