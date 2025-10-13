package com.ashelabs.turing.websocket;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * Unified WebSocket message format for all client-to-server communication.
 * Replaces all RSocket message types with a single flexible protocol.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class WebSocketMessage {
    
    /**
     * Unique identifier for correlating requests with responses
     */
    private String id;
    
    /**
     * Message type: "request", "subscribe", "unsubscribe", "command"
     */
    private String type;
    
    /**
     * For request type: "rooms.list", "room.state", "room.settings", "mqtt.status"
     */
    private String request;
    
    /**
     * For subscribe type: "room.state.stream", "room.settings.stream"
     */
    private String subscription;
    
    /**
     * For command type: "power", "temperature", "mode", "fan", "vane", "wideVane", "settings"
     */
    private String command;
    
    /**
     * Target room identifier (for room-specific operations)
     */
    private String roomId;
    
    /**
     * Command value or request parameter
     */
    private String value;
    
    /**
     * Timestamp when message was created (optional)
     */
    private Long timestamp;
    
    // Convenience constructors for different message types
    
    public static WebSocketMessage request(String id, String request) {
        return new WebSocketMessage(id, "request", request, null, null, null, null, System.currentTimeMillis());
    }
    
    public static WebSocketMessage request(String id, String request, String roomId) {
        return new WebSocketMessage(id, "request", request, null, null, roomId, null, System.currentTimeMillis());
    }
    
    public static WebSocketMessage subscribe(String id, String subscription, String roomId) {
        return new WebSocketMessage(id, "subscribe", null, subscription, null, roomId, null, System.currentTimeMillis());
    }
    
    public static WebSocketMessage unsubscribe(String id, String subscription, String roomId) {
        return new WebSocketMessage(id, "unsubscribe", null, subscription, null, roomId, null, System.currentTimeMillis());
    }
    
    public static WebSocketMessage command(String id, String command, String roomId, String value) {
        return new WebSocketMessage(id, "command", null, null, command, roomId, value, System.currentTimeMillis());
    }
}