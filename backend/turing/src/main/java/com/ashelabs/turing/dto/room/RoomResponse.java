package com.ashelabs.turing.dto.room;

import com.ashelabs.turing.entity.Room;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Enhanced DTO for room response with integrated device information.
 * 
 * This DTO provides a unified view of room data including metadata,
 * associated devices, and aggregate status statistics. It serves as
 * the primary response format for the unified room API.
 * 
 * @since 1.0.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomResponse {

    /**
     * Unique room identifier (UUID).
     */
    private UUID id;

    /**
     * Household ID this room belongs to.
     */
    private UUID householdId;

    /**
     * Room name.
     */
    private String name;

    /**
     * Stable business identifier (slug) for the room.
     * Used for assignments and references.
     */
    private String roomIdentifier;

    /**
     * Room location (optional).
     */
    private String location;

    /**
     * Room description (optional).
     */
    private String description;

    /**
     * List of devices associated with this room.
     * Includes device metadata and current status information.
     * Empty list if no devices are assigned to the room.
     */
    private List<DeviceInfo> devices;

    /**
     * Aggregate status statistics for the room.
     * Calculated from all devices in the room.
     * Null if no devices are present.
     */
    private AggregateStatus aggregateStatus;

    /**
     * Timestamp when room was created.
     */
    private Instant createdAt;

    /**
     * Timestamp when room was last updated.
     */
    private Instant updatedAt;

    /**
     * Timestamp when room data (including device information) was last refreshed.
     * Used for caching and determining data freshness.
     */
    private Instant lastDataUpdate;

    /**
     * Factory method to create RoomResponse from Room entity with device information.
     * 
     * This is the primary factory method that includes device data and aggregate
     * status calculation. It follows DRY principle by centralizing conversion logic.
     *
     * @param room Room entity
     * @param devices List of devices associated with the room
     * @return RoomResponse DTO with complete room information
     */
    public static RoomResponse from(Room room, List<DeviceInfo> devices) {
        List<DeviceInfo> deviceList = devices != null ? devices : List.of();
        AggregateStatus aggregateStatus = AggregateStatus.from(deviceList);
        
        // Calculate the most recent update time from devices or use current time
        Instant lastDataUpdate = deviceList.stream()
            .map(DeviceInfo::getLastStatusUpdate)
            .filter(timestamp -> timestamp != null)
            .max(Instant::compareTo)
            .orElse(Instant.now());
        
        return RoomResponse.builder()
            .id(room.getId())
            .householdId(room.getHouseholdId())
            .name(room.getName())
            .roomIdentifier(room.getRoomIdentifier())
            .location(room.getLocation())
            .description(room.getDescription())
            .devices(deviceList)
            .aggregateStatus(aggregateStatus)
            .createdAt(room.getCreatedAt())
            .updatedAt(room.getUpdatedAt())
            .lastDataUpdate(lastDataUpdate)
            .build();
    }

    /**
     * Factory method to create RoomResponse from Room entity without device information.
     * 
     * This method is provided for backward compatibility and cases where
     * device information is not needed or available.
     *
     * @param room Room entity
     * @return RoomResponse DTO with basic room information
     * @deprecated Use {@link #from(Room, List)} for complete room information
     */
    @Deprecated
    public static RoomResponse from(Room room) {
        return from(room, List.of());
    }

    /**
     * Factory method to create RoomResponse with explicit last data update timestamp.
     * 
     * This method allows setting a specific timestamp for when the data was last refreshed,
     * useful for caching scenarios where the refresh time is known.
     *
     * @param room Room entity
     * @param devices List of devices associated with the room
     * @param lastDataUpdate Timestamp when data was last refreshed
     * @return RoomResponse DTO with complete room information
     */
    public static RoomResponse from(Room room, List<DeviceInfo> devices, Instant lastDataUpdate) {
        RoomResponse response = from(room, devices);
        response.setLastDataUpdate(lastDataUpdate);
        return response;
    }

    /**
     * Check if room has any devices.
     * 
     * @return true if room has devices
     */
    public boolean hasDevices() {
        return devices != null && !devices.isEmpty();
    }

    /**
     * Check if room has any online devices.
     * 
     * @return true if at least one device is online
     */
    public boolean hasOnlineDevices() {
        return aggregateStatus != null && aggregateStatus.hasOnlineDevices();
    }

    /**
     * Check if room has any active devices.
     * 
     * @return true if at least one device is active
     */
    public boolean hasActiveDevices() {
        return aggregateStatus != null && aggregateStatus.isHasActiveDevices();
    }

    /**
     * Get device count.
     * 
     * @return Number of devices in the room
     */
    public int getDeviceCount() {
        return devices != null ? devices.size() : 0;
    }

    /**
     * Get online device count.
     * 
     * @return Number of online devices
     */
    public int getOnlineDeviceCount() {
        return aggregateStatus != null ? aggregateStatus.getOnlineDevices() : 0;
    }

    /**
     * Get active device count.
     * 
     * @return Number of active devices
     */
    public int getActiveDeviceCount() {
        return aggregateStatus != null ? aggregateStatus.getActiveDevices() : 0;
    }

    /**
     * Get average room temperature if available.
     * 
     * @return Average temperature or null if not available
     */
    public Double getAverageTemperature() {
        return aggregateStatus != null ? aggregateStatus.getAverageTemperature() : null;
    }

    /**
     * Get room status summary.
     * 
     * @return Human-readable status summary
     */
    public String getStatusSummary() {
        return aggregateStatus != null ? aggregateStatus.getStatusSummary() : "No status available";
    }

    /**
     * Check if room data is fresh based on a given age threshold.
     * 
     * @param maxAgeSeconds Maximum age in seconds for data to be considered fresh
     * @return true if data is fresh
     */
    public boolean isDataFresh(long maxAgeSeconds) {
        if (lastDataUpdate == null) {
            return false;
        }
        return Instant.now().minusSeconds(maxAgeSeconds).isBefore(lastDataUpdate);
    }

    /**
     * Get the age of the room data in seconds.
     * 
     * @return Age in seconds or -1 if last update time is not available
     */
    public long getDataAgeSeconds() {
        if (lastDataUpdate == null) {
            return -1;
        }
        return Instant.now().getEpochSecond() - lastDataUpdate.getEpochSecond();
    }

    /**
     * Update the last data update timestamp to current time.
     * 
     * @return This response for method chaining
     */
    public RoomResponse refreshDataTimestamp() {
        this.lastDataUpdate = Instant.now();
        return this;
    }

    /**
     * Check if room data needs refresh based on standard cache TTL (30 seconds).
     * 
     * @return true if data should be refreshed
     */
    public boolean needsRefresh() {
        return !isDataFresh(30); // 30 seconds default TTL
    }
}
