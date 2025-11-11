package com.ashelabs.turing.websocket.airconditioner.parser;

import com.ashelabs.turing.websocket.airconditioner.messages.AirConditionerInboundMessage;
import com.ashelabs.turing.websocket.airconditioner.messages.inbound.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

/**
 * Parser for air conditioner WebSocket messages.
 *
 * <p>Detects message type from "type" field and deserializes to appropriate message class.
 *
 * <p><strong>Single Responsibility</strong>: Parse air conditioner messages only.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AirConditionerMessageParser {

    private final ObjectMapper objectMapper;

    /**
     * Parse inbound message from JSON string.
     *
     * @param json JSON message from WebSocket client
     * @return Mono with typed message object
     */
    public Mono<AirConditionerInboundMessage> parseInboundMessage(String json) {
        return Mono.fromCallable(() -> {
            JsonNode node = objectMapper.readTree(json);
            String type = extractType(node);

            AirConditionerInboundMessage message = switch (type) {
                case "SET_TEMPERATURE" -> parseSetTemperature(node);
                case "SET_MODE" -> parseSetMode(node);
                case "SET_FAN_SPEED" -> parseSetFanSpeed(node);
                case "SET_POWER" -> parseSetPower(node);
                case "SET_SWING" -> parseSetSwing(node);
                case "GET_STATUS" -> parseGetStatus(node);
                case "SUBSCRIBE_TO_ROOM" -> parseSubscribeToRoom(node);
                case "UNSUBSCRIBE_FROM_ROOM" -> parseUnsubscribeFromRoom(node);
                default -> throw new IllegalArgumentException("Unknown message type: " + type);
            };
            return message;
        })
        .doOnError(e -> log.error("Failed to parse air conditioner message: {}", json, e))
        .onErrorResume(e -> Mono.empty()); // Skip malformed messages
    }

    private String extractType(JsonNode node) {
        if (!node.has("type")) {
            throw new IllegalArgumentException("Message missing 'type' field");
        }
        return node.get("type").asText();
    }

    private SetTemperatureMessage parseSetTemperature(JsonNode node) throws Exception {
        return objectMapper.treeToValue(node, SetTemperatureMessage.class);
    }

    private SetModeMessage parseSetMode(JsonNode node) throws Exception {
        return objectMapper.treeToValue(node, SetModeMessage.class);
    }

    private SetFanSpeedMessage parseSetFanSpeed(JsonNode node) throws Exception {
        return objectMapper.treeToValue(node, SetFanSpeedMessage.class);
    }

    private SetPowerMessage parseSetPower(JsonNode node) throws Exception {
        return objectMapper.treeToValue(node, SetPowerMessage.class);
    }

    private SetSwingMessage parseSetSwing(JsonNode node) throws Exception {
        return objectMapper.treeToValue(node, SetSwingMessage.class);
    }

    private GetStatusMessage parseGetStatus(JsonNode node) throws Exception {
        return objectMapper.treeToValue(node, GetStatusMessage.class);
    }

    private SubscribeToRoomMessage parseSubscribeToRoom(JsonNode node) throws Exception {
        return objectMapper.treeToValue(node, SubscribeToRoomMessage.class);
    }

    private UnsubscribeFromRoomMessage parseUnsubscribeFromRoom(JsonNode node) throws Exception {
        return objectMapper.treeToValue(node, UnsubscribeFromRoomMessage.class);
    }
}
