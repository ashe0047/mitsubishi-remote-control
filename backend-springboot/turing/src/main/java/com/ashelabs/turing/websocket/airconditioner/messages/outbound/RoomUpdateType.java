package com.ashelabs.turing.websocket.airconditioner.messages.outbound;

/**
 * Enumeration of room update types for WebSocket messages.
 * 
 * This enum categorizes the different types of room status updates
 * that can trigger WebSocket messages to clients.
 */
public enum RoomUpdateType {
    
    /**
     * Aggregate status change (e.g., room temperature average changed).
     * Triggered when room-level statistics are recalculated.
     */
    AGGREGATE_STATUS_CHANGE,
    
    /**
     * Device status change (e.g., AC mode, temperature setting changed).
     * Triggered when individual device settings or status change.
     */
    DEVICE_STATUS_CHANGE,
    
    /**
     * Device connectivity change (e.g., device came online/offline).
     * Triggered when device online status changes.
     */
    DEVICE_CONNECTIVITY_CHANGE,
    
    /**
     * Device added to room.
     * Triggered when a new device is assigned to the room.
     */
    DEVICE_ADDED,
    
    /**
     * Device removed from room.
     * Triggered when a device is unassigned from the room.
     */
    DEVICE_REMOVED,
    
    /**
     * Room configuration change (e.g., room name, description changed).
     * Triggered when room metadata is updated.
     */
    ROOM_CONFIG_CHANGE
}