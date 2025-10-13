package com.ashelabs.turing.websocket.airconditioner.messages.outbound;

import com.ashelabs.turing.websocket.airconditioner.messages.AirConditionerOutboundMessage;

/**
 * Command acknowledgment message.
 *
 * @param type Message type identifier ("ACK")
 * @param messageId Original message ID being acknowledged
 * @param command Command that was acknowledged
 * @param message Acknowledgment message
 */
public record AckMessage(
    String type,
    String messageId,
    String command,
    String message
) implements AirConditionerOutboundMessage {
    
    /**
     * Factory method for successful acknowledgment.
     * 
     * @param messageId Original message ID
     * @param command Command name
     * @param message Success message
     * @return AckMessage instance
     */
    public static AckMessage success(String messageId, String command, String message) {
        return new AckMessage("ACK", messageId, command, message);
    }
}
