package com.ashelabs.turing.dto.room;

import com.ashelabs.turing.dto.AirConSettings;
import com.ashelabs.turing.dto.AirConState;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class AggregateStatusTest {

    @Test
    void testFromEmptyDeviceList() {
        // When
        AggregateStatus status = AggregateStatus.from(List.of());

        // Then
        assertNotNull(status);
        assertFalse(status.isHasActiveDevices());
        assertNull(status.getAverageTemperature());
        assertEquals(0, status.getTotalDevices());
        assertEquals(0, status.getOnlineDevices());
        assertEquals(0, status.getEnabledDevices());
        assertEquals(0, status.getActiveDevices());
        assertNull(status.getAverageTargetTemperature());
        assertNull(status.getMinRoomTemperature());
        assertNull(status.getMaxRoomTemperature());
        assertEquals("No devices", status.getStatusSummary());
        assertEquals(0.0, status.getOnlinePercentage());
        assertEquals(0.0, status.getActivePercentage());
    }

    @Test
    void testFromNullDeviceList() {
        // When
        AggregateStatus status = AggregateStatus.from(null);

        // Then
        assertNotNull(status);
        assertEquals(0, status.getTotalDevices());
        assertEquals("No devices", status.getStatusSummary());
    }

    @Test
    void testFromMixedDevices() {
        // Given
        AirConState activeState = AirConState.builder()
            .temperature(22.0)
            .mode("cool")
            .fan("AUTO")
            .vane("AUTO")
            .wideVane("|")
            .roomTemperature(24.5)
            .build();

        AirConSettings activeSettings = AirConSettings.builder()
            .power("ON")
            .temperature(22.0)
            .mode("cool")
            .fan("AUTO")
            .vane("AUTO")
            .wideVane("|")
            .build();

        AirConState inactiveState = AirConState.builder()
            .temperature(25.0)
            .mode("off")
            .fan("AUTO")
            .vane("AUTO")
            .wideVane("|")
            .roomTemperature(26.0)
            .build();

        AirConSettings inactiveSettings = AirConSettings.builder()
            .power("OFF")
            .temperature(25.0)
            .mode("off")
            .fan("AUTO")
            .vane("AUTO")
            .wideVane("|")
            .build();

        DeviceInfo activeDevice = DeviceInfo.fromMqttDevice("device1", "Active Device", activeState, activeSettings, true);
        DeviceInfo inactiveDevice = DeviceInfo.fromMqttDevice("device2", "Inactive Device", inactiveState, inactiveSettings, true);
        DeviceInfo offlineDevice = DeviceInfo.offline("device3", "Offline Device");

        List<DeviceInfo> devices = List.of(activeDevice, inactiveDevice, offlineDevice);

        // When
        AggregateStatus status = AggregateStatus.from(devices);

        // Then
        assertNotNull(status);
        assertTrue(status.isHasActiveDevices());
        assertEquals(3, status.getTotalDevices());
        assertEquals(2, status.getOnlineDevices()); // active and inactive are online
        assertEquals(3, status.getEnabledDevices()); // all enabled by default
        assertEquals(1, status.getActiveDevices()); // only active device
        assertEquals(25.25, status.getAverageTemperature(), 0.01); // (24.5 + 26.0) / 2
        assertEquals(22.0, status.getAverageTargetTemperature()); // only active device has target temp
        assertEquals(24.5, status.getMinRoomTemperature());
        assertEquals(26.0, status.getMaxRoomTemperature());
        assertEquals(1.5, status.getTemperatureRange(), 0.01);
        assertTrue(status.hasTemperatureReadings());
        assertTrue(status.hasTemperatureVariation(1.0));
        assertFalse(status.allDevicesOnline());
        assertEquals(66.67, status.getOnlinePercentage(), 0.01);
        assertEquals(33.33, status.getActivePercentage(), 0.01);
        assertEquals("1 of 3 devices active", status.getStatusSummary());
    }

    @Test
    void testFromAllOfflineDevices() {
        // Given
        DeviceInfo offlineDevice1 = DeviceInfo.offline("device1", "Offline Device 1");
        DeviceInfo offlineDevice2 = DeviceInfo.offline("device2", "Offline Device 2");
        List<DeviceInfo> devices = List.of(offlineDevice1, offlineDevice2);

        // When
        AggregateStatus status = AggregateStatus.from(devices);

        // Then
        assertNotNull(status);
        assertFalse(status.isHasActiveDevices());
        assertEquals(2, status.getTotalDevices());
        assertEquals(0, status.getOnlineDevices());
        assertEquals(2, status.getEnabledDevices());
        assertEquals(0, status.getActiveDevices());
        assertNull(status.getAverageTemperature());
        assertNull(status.getAverageTargetTemperature());
        assertFalse(status.hasOnlineDevices());
        assertFalse(status.hasTemperatureReadings());
        assertEquals("All devices offline", status.getStatusSummary());
    }

    @Test
    void testEmptyFactory() {
        // When
        AggregateStatus status = AggregateStatus.empty();

        // Then
        assertNotNull(status);
        assertEquals(0, status.getTotalDevices());
        assertEquals("No devices", status.getStatusSummary());
    }
}