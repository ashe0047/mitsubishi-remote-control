package com.ashelabs.turing.websocket.airconditioner.messages.outbound;

import com.ashelabs.turing.websocket.airconditioner.messages.AirConditionerOutboundMessage;

/**
 * Error notification message to client.
 *
 * @param type Message type identifier ("ERROR")
 * @param messageId Original message ID that caused the error
 * @param command Command that failed
 * @param error Human-readable error message
 */
public record ErrorMessage(
    String type,
    String messageId,
    String command,
    String error
) implements AirConditionerOutboundMessage {
    
    /**
     * Factory method for command error.
     * 
     * @param messageId Original message ID
     * @param command Command name
     * @param error Error description
     * @return ErrorMessage instance
     */
    public static ErrorMessage forCommand(String messageId, String command, String error) {
        return new ErrorMessage("ERROR", messageId, command, error);
    }
}
