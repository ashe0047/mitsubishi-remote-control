package com.ashelabs.turing.dto.room;

import com.ashelabs.turing.dto.AirConSettings;
import com.ashelabs.turing.dto.AirConState;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class DeviceStatusTest {

    @Test
    void testFromAirConDataWithBothStateAndSettings() {
        // Given
        AirConState state = AirConState.builder()
            .temperature(24.0)
            .mode("cool")
            .fan("AUTO")
            .vane("AUTO")
            .wideVane("|")
            .roomTemperature(25.5)
            .compressorFrequency(45.0)
            .build();

        AirConSettings settings = AirConSettings.builder()
            .power("ON")
            .temperature(22.0)
            .mode("heat")
            .fan("2")
            .vane("3")
            .wideVane(">>")
            .build();

        // When
        DeviceStatus status = DeviceStatus.fromAirConData(state, settings);

        // Then
        assertNotNull(status);
        // Settings should take precedence
        assertEquals("ON", status.getPower());
        assertEquals(22.0, status.getTemperature());
        assertEquals("heat", status.getMode());
        assertEquals("2", status.getFan());
        assertEquals("3", status.getVane());
        assertEquals(">>", status.getWideVane());
        // State-specific data should be included
        assertEquals(25.5, status.getRoomTemperature());
        assertEquals(45.0, status.getCompressorFrequency());
        assertNotNull(status.getTimestamp());
        assertTrue(status.isActive());
        assertTrue(status.hasRoomTemperature());
        assertTrue(status.isHeating());
        assertFalse(status.isCooling());
    }

    @Test
    void testFromAirConDataWithStateOnly() {
        // Given
        AirConState state = AirConState.builder()
            .temperature(24.0)
            .mode("cool")
            .fan("AUTO")
            .vane("AUTO")
            .wideVane("|")
            .roomTemperature(25.5)
            .build();

        // When
        DeviceStatus status = DeviceStatus.fromAirConData(state, null);

        // Then
        assertNotNull(status);
        assertEquals("ON", status.getPower()); // Assumed ON if state exists
        assertEquals(24.0, status.getTemperature());
        assertEquals("cool", status.getMode());
        assertEquals("AUTO", status.getFan());
        assertEquals("AUTO", status.getVane());
        assertEquals("|", status.getWideVane());
        assertEquals(25.5, status.getRoomTemperature());
        assertTrue(status.isActive());
        assertTrue(status.isCooling());
    }

    @Test
    void testFromAirConDataWithNoData() {
        // When
        DeviceStatus status = DeviceStatus.fromAirConData(null, null);

        // Then
        assertNotNull(status);
        assertEquals("OFF", status.getPower());
        assertEquals(24.0, status.getTemperature());
        assertEquals("off", status.getMode());
        assertEquals("AUTO", status.getFan());
        assertEquals("AUTO", status.getVane());
        assertEquals("|", status.getWideVane());
        assertNull(status.getRoomTemperature());
        assertNull(status.getCompressorFrequency());
        assertFalse(status.isActive());
        assertFalse(status.hasRoomTemperature());
    }

    @Test
    void testOfflineStatus() {
        // When
        DeviceStatus status = DeviceStatus.offline();

        // Then
        assertNotNull(status);
        assertEquals("OFF", status.getPower());
        assertEquals("off", status.getMode());
        assertFalse(status.isActive());
        assertFalse(status.hasRoomTemperature());
        assertNotNull(status.getTimestamp());
    }

    @Test
    void testTemperatureDifference() {
        // Given
        DeviceStatus status = DeviceStatus.builder()
            .temperature(24.0)
            .roomTemperature(26.5)
            .build();

        // When
        Double difference = status.getTemperatureDifference();

        // Then
        assertNotNull(difference);
        assertEquals(2.5, difference, 0.01);
    }

    @Test
    void testTemperatureDifferenceWithNoRoomTemp() {
        // Given
        DeviceStatus status = DeviceStatus.builder()
            .temperature(24.0)
            .roomTemperature(null)
            .build();

        // When
        Double difference = status.getTemperatureDifference();

        // Then
        assertNull(difference);
    }
}