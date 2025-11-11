package com.ashelabs.turing.service;

import com.ashelabs.turing.config.MqttConfig;
import com.ashelabs.turing.dto.AirConSettings;
import com.ashelabs.turing.dto.AirConState;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.paho.client.mqttv3.*;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class MqttService implements MqttCallback {

    private final MqttConfig mqttConfig;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);
    
    private MqttClient mqttClient;
    private boolean isConnected = false;
    private int reconnectAttempts = 0;

    @Autowired
    public MqttService(MqttConfig mqttConfig, ApplicationEventPublisher eventPublisher, ObjectMapper objectMapper) {
        this.mqttConfig = mqttConfig;
        this.eventPublisher = eventPublisher;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void initialize() {
        log.info("Initializing MQTT service with broker: {}", mqttConfig.getFullBrokerUrl());
        connect();
    }

    @PreDestroy
    public void cleanup() {
        log.info("Cleaning up MQTT service");
        scheduler.shutdown();
        if (mqttClient != null && mqttClient.isConnected()) {
            try {
                mqttClient.disconnect();
                mqttClient.close();
            } catch (MqttException e) {
                log.error("Error disconnecting from MQTT broker", e);
            }
        }
    }

    private void connect() {
        try {
            if (mqttClient == null) {
                mqttClient = new MqttClient(
                    mqttConfig.getFullBrokerUrl(),
                    mqttConfig.getClientId(),
                    new MemoryPersistence()
                );
                mqttClient.setCallback(this);
            }

            if (!mqttClient.isConnected()) {
                MqttConnectOptions connOpts = new MqttConnectOptions();
                connOpts.setCleanSession(mqttConfig.getCleanSession());
                connOpts.setKeepAliveInterval(mqttConfig.getKeepAliveInterval());
                connOpts.setConnectionTimeout(mqttConfig.getConnectionTimeout());
                connOpts.setUserName(mqttConfig.getUsername());
                connOpts.setPassword(mqttConfig.getPassword().toCharArray());
                connOpts.setAutomaticReconnect(false); // Handle reconnection manually

                log.info("Connecting to MQTT broker: {}", mqttConfig.getFullBrokerUrl());
                mqttClient.connect(connOpts);
                
                // Subscribe to topics after successful connection
                subscribeToTopics();
                
                isConnected = true;
                reconnectAttempts = 0;
                
                log.info("Successfully connected to MQTT broker");
                eventPublisher.publishEvent(new MqttConnectionEvent(this, true));
            }
        } catch (MqttException e) {
            log.error("Failed to connect to MQTT broker", e);
            isConnected = false;
            scheduleReconnect();
        }
    }

    private void subscribeToTopics() {
        try {
            // Subscribe to state and settings topics with wildcards
            String stateTopicPattern = mqttConfig.getStateTopicPattern();
            String settingsTopicPattern = mqttConfig.getSettingsTopicPattern();
            
            log.info("Subscribing to MQTT topics: {} and {}", stateTopicPattern, settingsTopicPattern);
            
            mqttClient.subscribe(stateTopicPattern, 1);
            mqttClient.subscribe(settingsTopicPattern, 1);
            
            log.info("Successfully subscribed to MQTT topics");
        } catch (MqttException e) {
            log.error("Failed to subscribe to MQTT topics", e);
        }
    }

    private void scheduleReconnect() {
        if (reconnectAttempts < mqttConfig.getReconnectAttempts()) {
            reconnectAttempts++;
            long delay = mqttConfig.getReconnectDelay() * reconnectAttempts; // Exponential backoff
            
            log.info("Scheduling MQTT reconnect attempt {} in {} ms", reconnectAttempts, delay);
            
            scheduler.schedule(() -> {
                log.info("Attempting MQTT reconnect ({}/{})", reconnectAttempts, mqttConfig.getReconnectAttempts());
                connect();
            }, delay, TimeUnit.MILLISECONDS);
        } else {
            log.error("Maximum MQTT reconnect attempts ({}) reached", mqttConfig.getReconnectAttempts());
        }
    }

    public void publishCommand(String roomId, String command, Object value) {
        if (!isConnected || mqttClient == null || !mqttClient.isConnected()) {
            log.warn("Cannot publish MQTT command: not connected to broker");
            return;
        }

        try {
            String topic = mqttConfig.getCommandTopic(roomId, command);
            String payload = value.toString();
            
            log.debug("Publishing MQTT command: topic={}, payload={}", topic, payload);
            
            MqttMessage message = new MqttMessage(payload.getBytes());
            message.setQos(1);
            message.setRetained(false);
            
            mqttClient.publish(topic, message);
            log.info("Published MQTT command: {}={} for room {}", command, payload, roomId);
            
        } catch (MqttException e) {
            log.error("Failed to publish MQTT command: {}={} for room {}", command, value, roomId, e);
        }
    }

    public boolean isConnected() {
        return isConnected && mqttClient != null && mqttClient.isConnected();
    }

    // MqttCallback implementations
    @Override
    public void connectionLost(Throwable cause) {
        log.warn("MQTT connection lost", cause);
        isConnected = false;
        eventPublisher.publishEvent(new MqttConnectionEvent(this, false));
        scheduleReconnect();
    }

    @Override
    public void messageArrived(String topic, MqttMessage message) throws Exception {
        try {
            String payload = new String(message.getPayload());
            log.debug("MQTT message arrived: topic={}, payload={}", topic, payload);
            
            // Extract room ID from topic
            String roomId = extractRoomIdFromTopic(topic);
            if (roomId == null) {
                log.warn("Could not extract room ID from topic: {}", topic);
                return;
            }

            // Process message based on topic type
            if (topic.endsWith("/state")) {
                processStateMessage(roomId, payload);
            } else if (topic.endsWith("/settings")) {
                processSettingsMessage(roomId, payload);
            } else {
                log.warn("Unknown MQTT topic pattern: {}", topic);
            }
            
        } catch (Exception e) {
            log.error("Error processing MQTT message from topic: {}", topic, e);
        }
    }

    @Override
    public void deliveryComplete(IMqttDeliveryToken token) {
        log.debug("MQTT message delivery complete: {}", token.getMessageId());
    }

    private String extractRoomIdFromTopic(String topic) {
        // Extract room ID from pattern: mitsubishi2mqtt/{roomId}/state|settings
        String[] parts = topic.split("/");
        if (parts.length >= 3 && parts[0].equals(mqttConfig.getBaseTopic())) {
            return parts[1];
        }
        return null;
    }

    private void processStateMessage(String roomId, String payload) {
        try {
            AirConState state = objectMapper.readValue(payload, AirConState.class);
            log.info("Received state update for room {}: {}", roomId, state);
            eventPublisher.publishEvent(new MqttStateUpdateEvent(this, roomId, state));
        } catch (Exception e) {
            log.error("Failed to parse state message for room {}: {}", roomId, payload, e);
        }
    }

    private void processSettingsMessage(String roomId, String payload) {
        try {
            AirConSettings settings = objectMapper.readValue(payload, AirConSettings.class);
            log.info("Received settings update for room {}: {}", roomId, settings);
            eventPublisher.publishEvent(new MqttSettingsUpdateEvent(this, roomId, settings));
        } catch (Exception e) {
            log.error("Failed to parse settings message for room {}: {}", roomId, payload, e);
        }
    }
}