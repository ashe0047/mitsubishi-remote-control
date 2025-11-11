package com.ashelabs.turing.dto.room;

import com.ashelabs.turing.dto.AirConSettings;
import com.ashelabs.turing.dto.AirConState;
import com.ashelabs.turing.entity.Room;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class RoomResponseTest {

    @Test
    void testFromRoomWithDevices() {
        // Given
        Room room = Room.builder()
            .id(UUID.randomUUID())
            .householdId(UUID.randomUUID())
            .name("Living Room")
            .roomIdentifier("living-room")
            .location("Ground Floor")
            .description("Main living area")
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .build();

        AirConState state = AirConState.builder()
            .temperature(24.0)
            .mode("cool")
            .fan("AUTO")
            .vane("AUTO")
            .wideVane("|")
            .roomTemperature(25.5)
            .build();

        AirConSettings settings = AirConSettings.builder()
            .power("ON")
            .temperature(24.0)
            .mode("cool")
            .fan("AUTO")
            .vane("AUTO")
            .wideVane("|")
            .build();

        DeviceInfo device = DeviceInfo.fromMqttDevice("living-room", "Living Room AC", state, settings, true);
        List<DeviceInfo> devices = List.of(device);

        // When
        RoomResponse response = RoomResponse.from(room, devices);

        // Then
        assertNotNull(response);
        assertEquals(room.getId(), response.getId());
        assertEquals(room.getName(), response.getName());
        assertEquals(room.getRoomIdentifier(), response.getRoomIdentifier());
        assertEquals(1, response.getDevices().size());
        assertNotNull(response.getAggregateStatus());
        assertTrue(response.hasDevices());
        assertTrue(response.hasOnlineDevices());
        assertTrue(response.hasActiveDevices());
        assertEquals(1, response.getDeviceCount());
        assertEquals(1, response.getOnlineDeviceCount());
        assertEquals(1, response.getActiveDeviceCount());
        assertEquals(25.5, response.getAverageTemperature());
    }

    @Test
    void testFromRoomWithoutDevices() {
        // Given
        Room room = Room.builder()
            .id(UUID.randomUUID())
            .householdId(UUID.randomUUID())
            .name("Empty Room")
            .roomIdentifier("empty-room")
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .build();

        // When
        RoomResponse response = RoomResponse.from(room, List.of());

        // Then
        assertNotNull(response);
        assertEquals(room.getId(), response.getId());
        assertEquals(room.getName(), response.getName());
        assertEquals(0, response.getDevices().size());
        assertNotNull(response.getAggregateStatus());
        assertFalse(response.hasDevices());
        assertFalse(response.hasOnlineDevices());
        assertFalse(response.hasActiveDevices());
        assertEquals(0, response.getDeviceCount());
        assertEquals(0, response.getOnlineDeviceCount());
        assertEquals(0, response.getActiveDeviceCount());
        assertNull(response.getAverageTemperature());
        assertEquals("No devices", response.getStatusSummary());
    }

    @Test
    void testDeprecatedFromMethod() {
        // Given
        Room room = Room.builder()
            .id(UUID.randomUUID())
            .householdId(UUID.randomUUID())
            .name("Test Room")
            .roomIdentifier("test-room")
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .build();

        // When
        @SuppressWarnings("deprecation")
        RoomResponse response = RoomResponse.from(room);

        // Then
        assertNotNull(response);
        assertEquals(room.getId(), response.getId());
        assertEquals(room.getName(), response.getName());
        assertEquals(0, response.getDevices().size());
        assertNotNull(response.getAggregateStatus());
        assertFalse(response.hasDevices());
    }
}