package com.ashelabs.turing.websocket.airconditioner.messages.outbound;

import com.ashelabs.turing.dto.AirConSettings;
import com.ashelabs.turing.dto.AirConState;
import com.ashelabs.turing.dto.room.AggregateStatus;
import com.ashelabs.turing.dto.room.DeviceInfo;

import java.time.Instant;
import java.util.List;

/**
 * Payload for room status update message containing aggregate room information.
 *
 * This payload provides a complete view of room status including device counts,
 * temperature statistics, individual device status changes, and the raw state/settings payloads
 * from the originating MQTT event where available.
 *
 * @param roomId Room identifier (UUID as string)
 * @param roomName Human-readable room name
 * @param aggregateStatus Calculated aggregate status for the room
 * @param deviceUpdates List of devices that had status changes (optional)
 * @param timestamp When this status update was generated
 * @param updateType Type of update that triggered this message
 * @param state Raw device state snapshot (optional)
 * @param settings Raw device settings snapshot (optional)
 */
public record RoomStatusUpdatePayload(
    String roomId,
    String roomName,
    AggregateStatus aggregateStatus,
    List<DeviceInfo> deviceUpdates,
    Instant timestamp,
    RoomUpdateType updateType,
    AirConState state,
    AirConSettings settings
) {

    /**
     * Factory method to create payload for aggregate status change.
     *
     * @param roomId Room identifier
     * @param roomName Room name
     * @param aggregateStatus Updated aggregate status
     * @return RoomStatusUpdatePayload instance
     */
    public static RoomStatusUpdatePayload forAggregateUpdate(String roomId, String roomName,
                                                             AggregateStatus aggregateStatus) {
        return new RoomStatusUpdatePayload(
            roomId,
            roomName,
            aggregateStatus,
            null,
            Instant.now(),
            RoomUpdateType.AGGREGATE_STATUS_CHANGE,
            null,
            null
        );
    }

    /**
     * Factory method to create payload for device status changes.
     *
     * @param roomId Room identifier
     * @param roomName Room name
     * @param aggregateStatus Updated aggregate status
     * @param deviceUpdates List of devices with status changes
     * @return RoomStatusUpdatePayload instance
     */
    public static RoomStatusUpdatePayload forDeviceUpdates(String roomId, String roomName,
                                                           AggregateStatus aggregateStatus,
                                                           List<DeviceInfo> deviceUpdates,
                                                           AirConState state,
                                                           AirConSettings settings) {
        return new RoomStatusUpdatePayload(
            roomId,
            roomName,
            aggregateStatus,
            deviceUpdates,
            Instant.now(),
            RoomUpdateType.DEVICE_STATUS_CHANGE,
            state,
            settings
        );
    }

    /**
     * Factory method to create payload for device connectivity changes.
     *
     * @param roomId Room identifier
     * @param roomName Room name
     * @param aggregateStatus Updated aggregate status
     * @param deviceUpdates List of devices with connectivity changes
     * @return RoomStatusUpdatePayload instance
     */
    public static RoomStatusUpdatePayload forConnectivityUpdate(String roomId, String roomName,
                                                                AggregateStatus aggregateStatus,
                                                                List<DeviceInfo> deviceUpdates) {
        return new RoomStatusUpdatePayload(
            roomId,
            roomName,
            aggregateStatus,
            deviceUpdates,
            Instant.now(),
            RoomUpdateType.DEVICE_CONNECTIVITY_CHANGE,
            null,
            null
        );
    }
}
