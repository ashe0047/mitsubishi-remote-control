package com.ashelabs.turing.websocket.session;

/**
 * Enumeration of WebSocket subscription types for room updates.
 * 
 * This enum defines the different ways clients can subscribe to room
 * status updates through WebSocket connections.
 */
public enum SubscriptionType {
    
    /**
     * Subscribe to updates for a specific room only.
     * Client will receive updates only for the specified room.
     */
    SPECIFIC_ROOM,
    
    /**
     * Subscribe to updates for all rooms the user has access to.
     * Client will receive updates for all rooms in their household.
     */
    ALL_ROOMS,
    
    /**
     * Subscribe to updates for all rooms in the user's household.
     * Similar to ALL_ROOMS but explicitly scoped to household.
     */
    HOUSEHOLD_ROOMS
}