package com.ashelabs.turing.websocket.quota.parser;

import com.ashelabs.turing.websocket.quota.messages.QuotaInboundMessage;
import com.ashelabs.turing.websocket.quota.messages.inbound.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

/**
 * Parses incoming WebSocket JSON messages into QuotaInboundMessage objects.
 * Handles message type detection and payload extraction.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class QuotaMessageParser {

    private final ObjectMapper objectMapper;

    /**
     * Parses a JSON string into a QuotaInboundMessage.
     *
     * @param json the JSON message string
     * @return Mono containing the parsed message, or null if message type is ignored
     */
    public Mono<QuotaInboundMessage> parseInboundMessage(String json) {
        return Mono.fromCallable(() -> {
            try {
                JsonNode node = objectMapper.readTree(json);
                String type = node.get("type").asText();

                return switch (type) {
                    case "SUBSCRIBE_QUOTA" -> parseSubscribeMessage(node);
                    case "UNSUBSCRIBE_QUOTA" -> parseUnsubscribeMessage(node);
                    case "OVERRIDE_REQUEST" -> parseOverrideRequest(node);
                    case "OVERRIDE_APPROVAL" -> parseOverrideApproval(node);
                    default -> parseHealthCheckOrIgnore(node, type);
                };
            } catch (JsonProcessingException e) {
                throw new IllegalArgumentException("Invalid JSON message: " + e.getMessage());
            }
        });
    }

    private SubscribeMessage parseSubscribeMessage(JsonNode node) {
        String quotaId = node.get("payload").get("quotaId").asText();
        return new SubscribeMessage(quotaId);
    }

    private UnsubscribeMessage parseUnsubscribeMessage(JsonNode node) {
        String quotaId = node.get("payload").get("quotaId").asText();
        return new UnsubscribeMessage(quotaId);
    }

    private OverrideRequestInbound parseOverrideRequest(JsonNode node) {
        JsonNode payload = node.get("payload");
        return new OverrideRequestInbound(
                payload.get("quotaId").asText(),
                payload.get("requestType").asText(),
                payload.get("duration").asInt(),
                payload.get("reason").asText(),
                payload.get("urgency").asText()
        );
    }

    private OverrideApprovalMessage parseOverrideApproval(JsonNode node) {
        JsonNode payload = node.get("payload");
        return new OverrideApprovalMessage(
                payload.get("requestId").asText(),
                payload.get("approved").asBoolean(),
                payload.has("reason") ? payload.get("reason").asText() : null
        );
    }

    private QuotaInboundMessage parseHealthCheckOrIgnore(JsonNode node, String type) {
        // Handle health check and ping messages
        if ("request".equals(type)) {
            JsonNode requestNode = node.get("request");
            if (requestNode != null) {
                String requestType = requestNode.asText();
                String messageId = node.has("id") ? node.get("id").asText() : null;
                log.debug("Handling client request: {} with ID: {}", requestType, messageId);

                // Create a health check response message
                if ("mqtt.status".equals(requestType) || "ping".equals(requestType)) {
                    return new HealthCheckMessage(messageId, requestType);
                }
            }
        } else {
            log.debug("Ignoring unknown message type: {}", type);
        }
        return null; // Return null for non-health-check messages
    }
}
