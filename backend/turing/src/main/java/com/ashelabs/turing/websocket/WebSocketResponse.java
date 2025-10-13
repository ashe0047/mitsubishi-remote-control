package com.ashelabs.turing.websocket;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * WebSocket response format for all server-to-client communication.
 * Handles responses, stream data, acknowledgments, and errors.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class WebSocketResponse {
    
    /**
     * Correlation ID from the original request (for responses and acks)
     */
    private String id;
    
    /**
     * Response type: "response", "stream", "ack", "error"
     */
    private String type;
    
    /**
     * Source request/subscription name for reference
     */
    private String source;
    
    /**
     * Room identifier for room-specific responses
     */
    private String roomId;
    
    /**
     * Response payload (for responses and stream data)
     */
    private Object data;
    
    /**
     * Error message (for error responses)
     */
    private String error;
    
    /**
     * Timestamp when response was created
     */
    private Long timestamp;
    
    // Convenience constructors for different response types
    
    public static WebSocketResponse response(String id, String source, Object data) {
        return new WebSocketResponse(id, "response", source, null, data, null, System.currentTimeMillis());
    }
    
    public static WebSocketResponse response(String id, String source, String roomId, Object data) {
        return new WebSocketResponse(id, "response", source, roomId, data, null, System.currentTimeMillis());
    }
    
    public static WebSocketResponse stream(String source, String roomId, Object data) {
        return new WebSocketResponse(null, "stream", source, roomId, data, null, System.currentTimeMillis());
    }
    
    public static WebSocketResponse ack(String id, String source) {
        return new WebSocketResponse(id, "ack", source, null, null, null, System.currentTimeMillis());
    }
    
    public static WebSocketResponse ack(String id, String source, String roomId) {
        return new WebSocketResponse(id, "ack", source, roomId, null, null, System.currentTimeMillis());
    }
    
    public static WebSocketResponse error(String id, String source, String error) {
        return new WebSocketResponse(id, "error", source, null, null, error, System.currentTimeMillis());
    }
    
    public static WebSocketResponse error(String id, String source, String roomId, String error) {
        return new WebSocketResponse(id, "error", source, roomId, null, error, System.currentTimeMillis());
    }
}