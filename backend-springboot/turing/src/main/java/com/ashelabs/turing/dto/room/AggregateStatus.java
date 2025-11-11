package com.ashelabs.turing.dto.room;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.OptionalDouble;

/**
 * DTO representing aggregate status statistics for a room.
 * 
 * This DTO provides room-level statistics calculated from all devices
 * in the room, offering a consolidated view of room status for dashboards
 * and overview interfaces.
 * 
 * @since 1.0.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AggregateStatus {

    /**
     * Whether the room has any actively running devices.
     * A device is considered active if it's online, powered on, and not in "off" mode.
     */
    private boolean hasActiveDevices;

    /**
     * Average room temperature across all devices with temperature readings.
     * Null if no devices have temperature readings available.
     */
    private Double averageTemperature;

    /**
     * Total number of devices in the room.
     * Includes both online and offline devices.
     */
    private int totalDevices;

    /**
     * Number of devices currently online and responding.
     */
    private int onlineDevices;

    /**
     * Number of devices that are enabled for use.
     * Disabled devices cannot be controlled.
     */
    private int enabledDevices;

    /**
     * Number of devices that are currently active (powered on and running).
     */
    private int activeDevices;

    /**
     * Average target temperature setting across active devices.
     * Null if no devices are active or have temperature settings.
     */
    private Double averageTargetTemperature;

    /**
     * Minimum room temperature reading across all devices.
     * Null if no temperature readings available.
     */
    private Double minRoomTemperature;

    /**
     * Maximum room temperature reading across all devices.
     * Null if no temperature readings available.
     */
    private Double maxRoomTemperature;

    /**
     * Factory method to calculate aggregate status from device list.
     * 
     * This method handles all edge cases including empty device lists,
     * offline devices, and missing temperature readings.
     * 
     * @param devices List of devices in the room
     * @return AggregateStatus with calculated statistics
     */
    public static AggregateStatus from(List<DeviceInfo> devices) {
        if (devices == null || devices.isEmpty()) {
            return AggregateStatus.builder()
                .hasActiveDevices(false)
                .averageTemperature(null)
                .totalDevices(0)
                .onlineDevices(0)
                .enabledDevices(0)
                .activeDevices(0)
                .averageTargetTemperature(null)
                .minRoomTemperature(null)
                .maxRoomTemperature(null)
                .build();
        }

        // Count devices by status
        int totalCount = devices.size();
        int onlineCount = (int) devices.stream().filter(DeviceInfo::isOnline).count();
        int enabledCount = (int) devices.stream().filter(DeviceInfo::isEnabled).count();
        int activeCount = (int) devices.stream().filter(DeviceInfo::hasActiveStatus).count();

        // Calculate temperature statistics
        List<Double> roomTemperatures = devices.stream()
            .filter(d -> d.getCurrentRoomTemperature() != null)
            .map(DeviceInfo::getCurrentRoomTemperature)
            .toList();

        List<Double> targetTemperatures = devices.stream()
            .filter(d -> d.hasActiveStatus() && d.getCurrentStatus() != null)
            .map(d -> d.getCurrentStatus().getTemperature())
            .filter(temp -> temp != null)
            .toList();

        // Calculate averages
        OptionalDouble avgRoomTemp = roomTemperatures.stream().mapToDouble(Double::doubleValue).average();
        OptionalDouble avgTargetTemp = targetTemperatures.stream().mapToDouble(Double::doubleValue).average();

        // Calculate min/max room temperatures
        OptionalDouble minRoomTemp = roomTemperatures.stream().mapToDouble(Double::doubleValue).min();
        OptionalDouble maxRoomTemp = roomTemperatures.stream().mapToDouble(Double::doubleValue).max();

        return AggregateStatus.builder()
            .hasActiveDevices(activeCount > 0)
            .averageTemperature(avgRoomTemp.isPresent() ? avgRoomTemp.getAsDouble() : null)
            .totalDevices(totalCount)
            .onlineDevices(onlineCount)
            .enabledDevices(enabledCount)
            .activeDevices(activeCount)
            .averageTargetTemperature(avgTargetTemp.isPresent() ? avgTargetTemp.getAsDouble() : null)
            .minRoomTemperature(minRoomTemp.isPresent() ? minRoomTemp.getAsDouble() : null)
            .maxRoomTemperature(maxRoomTemp.isPresent() ? maxRoomTemp.getAsDouble() : null)
            .build();
    }

    /**
     * Factory method for empty room (no devices).
     * 
     * @return AggregateStatus representing a room with no devices
     */
    public static AggregateStatus empty() {
        return from(List.of());
    }

    /**
     * Check if room has any online devices.
     * 
     * @return true if at least one device is online
     */
    public boolean hasOnlineDevices() {
        return onlineDevices > 0;
    }

    /**
     * Check if all devices are online.
     * 
     * @return true if all devices are online (or no devices exist)
     */
    public boolean allDevicesOnline() {
        return totalDevices == 0 || onlineDevices == totalDevices;
    }

    /**
     * Get percentage of devices that are online.
     * 
     * @return Percentage (0-100) or 0 if no devices
     */
    public double getOnlinePercentage() {
        if (totalDevices == 0) {
            return 0.0;
        }
        return (double) onlineDevices / totalDevices * 100.0;
    }

    /**
     * Get percentage of devices that are active.
     * 
     * @return Percentage (0-100) or 0 if no devices
     */
    public double getActivePercentage() {
        if (totalDevices == 0) {
            return 0.0;
        }
        return (double) activeDevices / totalDevices * 100.0;
    }

    /**
     * Check if room temperature readings are available.
     * 
     * @return true if average temperature is available
     */
    public boolean hasTemperatureReadings() {
        return averageTemperature != null;
    }

    /**
     * Get temperature range (max - min) if available.
     * 
     * @return Temperature range or null if not available
     */
    public Double getTemperatureRange() {
        if (minRoomTemperature == null || maxRoomTemperature == null) {
            return null;
        }
        return maxRoomTemperature - minRoomTemperature;
    }

    /**
     * Check if room has temperature variation (range > threshold).
     * 
     * @param threshold Temperature difference threshold
     * @return true if temperature range exceeds threshold
     */
    public boolean hasTemperatureVariation(double threshold) {
        Double range = getTemperatureRange();
        return range != null && range > threshold;
    }

    /**
     * Get a summary status string for the room.
     * 
     * @return Human-readable status summary
     */
    public String getStatusSummary() {
        if (totalDevices == 0) {
            return "No devices";
        }
        
        if (onlineDevices == 0) {
            return "All devices offline";
        }
        
        if (activeDevices == 0) {
            return String.format("%d device%s online, none active", 
                onlineDevices, onlineDevices == 1 ? "" : "s");
        }
        
        return String.format("%d of %d device%s active", 
            activeDevices, totalDevices, totalDevices == 1 ? "" : "s");
    }
}