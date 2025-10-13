package com.ashelabs.turing.infrastructure.protocol.mqtt;

import com.ashelabs.turing.application.device.DeviceDiscoveryService;
import com.ashelabs.turing.application.device.DeviceService;
import com.ashelabs.turing.domain.device.DeviceType;
import com.ashelabs.turing.websocket.session.WebSocketSessionRegistry;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.eclipse.paho.client.mqttv3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Subscribes to MQTT topics and routes messages to WebSocket clients.
 * Handles device state updates and dynamic device discovery.
 *
 * This enables bidirectional communication: Device → MQTT → WebSocket clients
 */
@Service
public class MqttMessageSubscriber {

    private static final Logger logger = LoggerFactory.getLogger(MqttMessageSubscriber.class);

    // Topic patterns for device messages
    private static final String STATE_TOPIC_PATTERN = "%s/+/state";      // mitsubishi2mqtt/+/state
    private static final String SETTINGS_TOPIC_PATTERN = "%s/+/settings"; // mitsubishi2mqtt/+/settings

    private final String brokerUrl;
    private final String clientId;
    private final String baseTopic;
    private final String username;
    private final String password;
    private final DeviceService deviceService;
    private final DeviceDiscoveryService deviceDiscoveryService;
    private final WebSocketSessionRegistry sessionRegistry;
    private final ObjectMapper objectMapper;

    private MqttClient mqttClient;

    public MqttMessageSubscriber(
        @Value("${mqtt.broker-url}") String brokerHost,
        @Value("${mqtt.broker-port}") int brokerPort,
        @Value("${mqtt.client-id}") String baseClientId,
        @Value("${mqtt.base-topic}") String baseTopic,
        @Value("${mqtt.username}") String username,
        @Value("${mqtt.password}") String password,
        DeviceService deviceService,
        DeviceDiscoveryService deviceDiscoveryService,
        WebSocketSessionRegistry sessionRegistry,
        ObjectMapper objectMapper
    ) {
        this.brokerUrl = String.format("tcp://%s:%d", brokerHost, brokerPort);
        this.clientId = baseClientId + "-subscriber";
        this.baseTopic = baseTopic;
        this.username = username;
        this.password = password;
        this.deviceService = deviceService;
        this.deviceDiscoveryService = deviceDiscoveryService;
        this.sessionRegistry = sessionRegistry;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void start() throws MqttException {
        this.mqttClient = new MqttClient(brokerUrl, clientId);

        MqttConnectOptions options = new MqttConnectOptions();
        options.setAutomaticReconnect(true);
        options.setCleanSession(true);
        options.setConnectionTimeout(30);
        options.setKeepAliveInterval(60);

        if (username != null && !username.isBlank()) {
            options.setUserName(username);
            options.setPassword(password.toCharArray());
        }

        mqttClient.setCallback(new MqttCallback() {
            @Override
            public void connectionLost(Throwable cause) {
                logger.error("MQTT subscriber connection lost", cause);
            }

            @Override
            public void messageArrived(String topic, MqttMessage message) {
                handleIncomingMessage(topic, message);
            }

            @Override
            public void deliveryComplete(IMqttDeliveryToken token) {
                // Not used for subscriber
            }
        });

        mqttClient.connect(options);

        // Subscribe to all topics to capture every discovery payload
        String wildcardTopic = "#";
        mqttClient.subscribe(wildcardTopic, 1);
        logger.info("MQTT Subscriber started and subscribed to wildcard topic: {}", wildcardTopic);

        // Ensure we also listen to namespaces relevant for discovery
        mqttClient.subscribe(baseTopic + "/#", 1);
        mqttClient.subscribe("homeassistant/#", 1);
        logger.info("MQTT Subscriber ensured subscriptions for {} and homeassistant/#", baseTopic + "/#");
    }

    @PreDestroy
    public void stop() throws MqttException {
        if (mqttClient != null && mqttClient.isConnected()) {
            mqttClient.disconnect();
            mqttClient.close();
        }
        logger.info("MQTT Subscriber stopped");
    }

    /**
     * Handle incoming MQTT message and route to WebSocket clients.
     * Format: mitsubishi2mqtt/{deviceIdentifier}/{messageType}
     *
     * @param topic MQTT topic
     * @param message MQTT message
     */
    private void handleIncomingMessage(String topic, MqttMessage message) {
        try {
            String messageType = extractMessageType(topic);
            String payload = new String(message.getPayload());

            // logger.info("Received MQTT message: topic={}, payload={}", topic, payload);

            Map<String, Object> payloadMap = parsePayload(payload);
            if (payloadMap == null) {
                logger.debug("Skipping MQTT message with non-JSON payload for topic {}", topic);
                return;
            }

            String deviceIdentifier = extractDeviceIdentifierFromPayload(payloadMap);
            if (deviceIdentifier == null || deviceIdentifier.isBlank()) {
                // logger.debug("Skipping MQTT message without device.ids field for topic {}", topic);
                return;
            }

            logger.debug("Resolved device identifier {} from topic {}", deviceIdentifier, topic);
            logger.debug("Device message type: {}", messageType);
            final Map<String, Object> payloadSnapshot = new LinkedHashMap<>(payloadMap);

            deviceService.getDeviceByIdentifier(deviceIdentifier)
                .flatMap(device -> {
                    try {
                        Map<String, Object> wsMessage = Map.of(
                            "type", messageType.toUpperCase(),
                            "deviceIdentifier", deviceIdentifier,
                            "deviceType", device.deviceType().getCode(),
                            "data", payloadSnapshot,
                            "timestamp", System.currentTimeMillis()
                        );

                        String wsPayload = objectMapper.writeValueAsString(wsMessage);
                        sessionRegistry.broadcastToRoom(device.roomId(), wsPayload);

                        return deviceDiscoveryService.dismissDiscovery(deviceIdentifier)
                            .onErrorResume(err -> {
                                logger.debug("No discovery entry to dismiss for {}: {}", deviceIdentifier, err.getMessage());
                                return Mono.empty();
                            })
                            .thenReturn(device);
                    } catch (Exception e) {
                        logger.error("Error processing MQTT message payload", e);
                        return Mono.just(device);
                    }
                })
                .switchIfEmpty(Mono.defer(() -> {
                    logger.info("No registered device found for {}. Recording discovery.", deviceIdentifier);
                    return triggerDeviceDiscovery(topic, deviceIdentifier, messageType, payloadSnapshot)
                        .then(Mono.empty());
                }))
                .onErrorResume(error -> {
                    logger.error("Error handling MQTT message for {}. Attempting discovery fallback.", deviceIdentifier, error);
                    return triggerDeviceDiscovery(topic, deviceIdentifier, messageType, payloadSnapshot)
                        .then(Mono.empty());
                })
                .subscribe();

        } catch (Exception e) {
            logger.error("Error processing MQTT message from topic: " + topic, e);
        }
    }

    /**
     * Extract message type from MQTT topic.
     * Returns: "state" or "settings"
     *
     * @param topic MQTT topic
     * @return Message type
     */
    private String extractMessageType(String topic) {
        String[] parts = topic.split("/");
        return parts.length >= 3 ? parts[2] : "unknown";
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parsePayload(String payload) {
        if (payload == null) {
            return null;
        }

        String trimmed = payload.trim();
        if (trimmed.isEmpty()) {
            return null;
        }

        try {
            Object parsed = objectMapper.readValue(trimmed, Map.class);
            if (parsed instanceof Map<?, ?> map) {
                return (Map<String, Object>) map;
            }
        } catch (Exception ex) {
            // logger.debug("Skipping non-JSON MQTT payload: {}", trimmed);
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private String extractDeviceIdentifierFromPayload(Map<String, Object> payload) {
        Object deviceNode = payload.get("device");
        if (!(deviceNode instanceof Map<?, ?> rawDeviceMap)) {
            return null;
        }

        Map<String, Object> deviceMap = (Map<String, Object>) rawDeviceMap;
        Object idsValue = deviceMap.get("ids");
        if (idsValue == null) {
            return null;
        }

        if (idsValue instanceof String idsString) {
            String[] tokens = idsString.split(",");
            for (int i = tokens.length - 1; i >= 0; i--) {
                String candidate = tokens[i].trim();
                if (!candidate.isEmpty() && !candidate.equalsIgnoreCase(baseTopic)) {
                    return candidate;
                }
            }
            return null;
        }

        if (idsValue instanceof Iterable<?> iterable) {
            String lastCandidate = null;
            for (Object element : iterable) {
                if (element instanceof String str && !str.isBlank()) {
                    lastCandidate = str.trim();
                }
            }
            if (lastCandidate != null && !lastCandidate.equalsIgnoreCase(baseTopic)) {
                return lastCandidate;
            }
            return null;
        }

        if (idsValue.getClass().isArray()) {
            String lastCandidate = null;
            int length = java.lang.reflect.Array.getLength(idsValue);
            for (int i = 0; i < length; i++) {
                Object element = java.lang.reflect.Array.get(idsValue, i);
                if (element instanceof String str && !str.isBlank()) {
                    lastCandidate = str.trim();
                }
            }
            if (lastCandidate != null && !lastCandidate.equalsIgnoreCase(baseTopic)) {
                return lastCandidate;
            }
            return null;
        }

        if (idsValue instanceof Map<?, ?> map) {
            for (Object value : map.values()) {
                if (value instanceof String str && !str.isBlank()) {
                    String candidate = str.trim();
                    if (!candidate.equalsIgnoreCase(baseTopic)) {
                        return candidate;
                    }
                }
            }
            return null;
        }

        return null;
    }

    /**
     * Trigger dynamic device discovery when unknown device sends MQTT message.
     * Broadcasts discovery event to all WebSocket sessions for user-driven registration.
     *
     * @param topic MQTT topic
     * @param deviceIdentifier Device identifier
     * @param messageType Message type
     * @param payload Message payload
     */
    private Mono<Void> triggerDeviceDiscovery(String topic, String deviceIdentifier, String messageType, Map<String, Object> parsedPayload) {
        Map<String, Object> payloadSnapshot = new LinkedHashMap<>(parsedPayload);
        Map<String, Object> metadata = Map.of(
            "mqttTopic", topic,
            "mqttMessageType", messageType
        );

        return deviceDiscoveryService.recordDiscovery(
                deviceIdentifier,
                null,
                DeviceType.AIRCONDITIONER,
                payloadSnapshot,
                metadata
            )
            .flatMap(discovery -> Mono.fromCallable(() -> {
                Map<String, Object> discoveryPayload = new HashMap<>();
                discoveryPayload.put("messageType", "DEVICE_DISCOVERED");
                discoveryPayload.put("deviceIdentifier", discovery.deviceIdentifier());
                discoveryPayload.put("deviceType", discovery.deviceType() != null ? discovery.deviceType().getCode() : "unknown");
                discoveryPayload.put("mqttMessageType", messageType);
                discoveryPayload.put("mqttPayload", payloadSnapshot);
                discoveryPayload.put("firstSeenAt", discovery.firstSeenAt().toEpochMilli());
                discoveryPayload.put("lastSeenAt", discovery.lastSeenAt().toEpochMilli());
                discoveryPayload.put("requiresRegistration", discovery.requiresRegistration());
                if (discovery.roomId() != null) {
                    discoveryPayload.put("roomId", discovery.roomId().toString());
                }
                if (!discovery.metadata().isEmpty()) {
                    discoveryPayload.put("metadata", discovery.metadata());
                }

                Map<String, Object> wsMessage = new HashMap<>();
                wsMessage.put("type", "device");
                wsMessage.put("messageId", UUID.randomUUID().toString());
                wsMessage.put("timestamp", System.currentTimeMillis());
                wsMessage.put("payload", discoveryPayload);

                String wsPayload = objectMapper.writeValueAsString(wsMessage);
                sessionRegistry.broadcastToAll(wsPayload);

                logger.info("Device discovery triggered for unknown device: {}", deviceIdentifier);
                return (Void) null;
            }))
            .onErrorResume(error -> {
                logger.error("Error triggering device discovery", error);
                return Mono.empty();
            })
            .then();
    }
}
