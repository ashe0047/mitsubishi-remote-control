package com.ashelabs.turing.dto.room;

import com.ashelabs.turing.dto.AirConSettings;
import com.ashelabs.turing.dto.AirConState;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.time.Instant;

/**
 * DTO representing real-time device status information.
 * 
 * This DTO consolidates current device state and settings into a unified
 * status representation for API responses. It includes validation constraints
 * to ensure data integrity.
 * 
 * @since 1.0.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceStatus {

    /**
     * Device power state.
     * Valid values: "ON", "OFF" (case-insensitive)
     */
    @NotNull
    @Pattern(regexp = "ON|OFF|on|off", 
             message = "Invalid power value. Must be ON or OFF")
    private String power;

    /**
     * Target temperature setting.
     * Range: 16-31 degrees Celsius
     */
    @NotNull
    @DecimalMin(value = "16", message = "Temperature must be at least 16°C")
    @DecimalMax(value = "31", message = "Temperature must be at most 31°C")
    private Double temperature;

    /**
     * Operating mode.
     * Valid values: "off", "heat_cool", "cool", "dry", "heat", "fan_only"
     */
    @NotNull
    @Pattern(regexp = "off|heat_cool|cool|dry|heat|fan_only", 
             message = "Invalid mode value")
    private String mode;

    /**
     * Fan speed setting.
     * Valid values: "AUTO", "1", "2", "3", "4", "QUIET", "auto", "low", "middle", "medium", "high", "diffuse"
     */
    @NotNull
    @Pattern(regexp = "AUTO|1|2|3|4|QUIET|auto|low|middle|medium|high|diffuse", 
             message = "Invalid fan value")
    private String fan;

    /**
     * Vertical vane position.
     * Valid values: "AUTO", "1", "2", "3", "4", "5", "SWING"
     */
    @Pattern(regexp = "AUTO|1|2|3|4|5|SWING", 
             message = "Invalid vane value")
    private String vane;

    /**
     * Horizontal vane position.
     * Valid values: "<<", "<", "|", ">", ">>", "SWING"
     */
    @Pattern(regexp = "<<|<|\\||>|>>|SWING", 
             message = "Invalid wide vane value")
    private String wideVane;

    /**
     * Current room temperature reading.
     * May be null if sensor is unavailable or reading is invalid.
     */
    private Double roomTemperature;

    /**
     * Compressor frequency (if available).
     * Indicates current compressor operation level.
     */
    private Double compressorFrequency;

    /**
     * Timestamp when this status was captured.
     * Used to determine freshness of status data.
     */
    @NotNull
    private Instant timestamp;

    /**
     * Factory method to create DeviceStatus from AirCon DTOs.
     * 
     * This method combines AirConState and AirConSettings into a unified
     * status representation, handling null values gracefully.
     * 
     * @param state Current AC state (may be null)
     * @param settings Current AC settings (may be null)
     * @return DeviceStatus instance with combined data
     */
    public static DeviceStatus fromAirConData(AirConState state, AirConSettings settings) {
        DeviceStatusBuilder builder = DeviceStatus.builder()
            .timestamp(Instant.now());

        // Prefer settings for control values, fall back to state
        if (settings != null) {
            builder.power(settings.getPower())
                   .temperature(settings.getTemperature())
                   .mode(settings.getMode())
                   .fan(settings.getFan())
                   .vane(settings.getVane())
                   .wideVane(settings.getWideVane());
        } else if (state != null) {
            // If no settings, try to extract from state
            builder.power("ON") // Assume ON if we have state data
                   .temperature(state.getTemperature())
                   .mode(state.getMode())
                   .fan(state.getFan())
                   .vane(state.getVane())
                   .wideVane(state.getWideVane());
        } else {
            // No data available - create minimal status
            builder.power("OFF")
                   .temperature(24.0)
                   .mode("off")
                   .fan("AUTO")
                   .vane("AUTO")
                   .wideVane("|");
        }

        // Add state-specific data if available
        if (state != null) {
            builder.roomTemperature(state.getRoomTemperature())
                   .compressorFrequency(state.getCompressorFrequency());
        }

        return builder.build();
    }

    /**
     * Factory method to create offline device status.
     * 
     * @return DeviceStatus representing an offline device
     */
    public static DeviceStatus offline() {
        return DeviceStatus.builder()
            .power("OFF")
            .temperature(24.0)
            .mode("off")
            .fan("AUTO")
            .vane("AUTO")
            .wideVane("|")
            .roomTemperature(null)
            .compressorFrequency(null)
            .timestamp(Instant.now())
            .build();
    }

    /**
     * Check if device is actively running (powered on and not in off mode).
     * 
     * @return true if device is active
     */
    public boolean isActive() {
        return "ON".equalsIgnoreCase(power) && 
               mode != null && 
               !"off".equalsIgnoreCase(mode);
    }

    /**
     * Check if room temperature is available.
     * 
     * @return true if room temperature reading is available
     */
    public boolean hasRoomTemperature() {
        return roomTemperature != null && roomTemperature > -1;
    }

    /**
     * Get temperature difference between target and room temperature.
     * 
     * @return Temperature difference or null if room temperature unavailable
     */
    public Double getTemperatureDifference() {
        if (!hasRoomTemperature() || temperature == null) {
            return null;
        }
        return Math.abs(temperature - roomTemperature);
    }

    /**
     * Check if device is in heating mode.
     * 
     * @return true if in heating mode
     */
    public boolean isHeating() {
        return "heat".equalsIgnoreCase(mode) || "heat_cool".equalsIgnoreCase(mode);
    }

    /**
     * Check if device is in cooling mode.
     * 
     * @return true if in cooling mode
     */
    public boolean isCooling() {
        return "cool".equalsIgnoreCase(mode) || "heat_cool".equalsIgnoreCase(mode);
    }
}