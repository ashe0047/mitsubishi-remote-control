package com.ashelabs.turing.exception;

import com.ashelabs.turing.dto.QuotaValidationResult;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for RoomControllerErrorHandler.
 */
class RoomControllerErrorHandlerTest {

    @Test
    void testMapQuotaExceededException() {
        // Given
        UUID userId = UUID.randomUUID();
        String roomId = "room-123";
        String action = "power_on";
        QuotaValidationResult validationResult = QuotaValidationResult.block("Daily limit exceeded");
        QuotaExceededException exception = QuotaExceededException.fromValidationResult(
            validationResult, userId, roomId, action);

        // When
        ResponseStatusException result = RoomControllerErrorHandler.mapException(
            exception, "/api/rooms/test");

        // Then
        assertEquals(HttpStatus.FORBIDDEN, result.getStatusCode());
        assertNotNull(result.getReason());
        assertTrue(result.getReason().contains("QuotaExceeded"));
    }

    @Test
    void testMapDeviceUnavailableException() {
        // Given
        String deviceId = "device-123";
        String roomId = "room-123";
        DeviceUnavailableException exception = DeviceUnavailableException.deviceTimeout(
            deviceId, roomId, 5000);

        // When
        ResponseStatusException result = RoomControllerErrorHandler.mapException(
            exception, "/api/rooms/test");

        // Then
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, result.getStatusCode());
        assertNotNull(result.getReason());
        assertTrue(result.getReason().contains("DeviceUnavailable"));
    }

    @Test
    void testMapRoomAccessDeniedException() {
        // Given
        UUID userId = UUID.randomUUID();
        UUID roomId = UUID.randomUUID();
        RoomAccessDeniedException exception = RoomAccessDeniedException.insufficientRole(
            userId, roomId, "CHILD", "PARENT");

        // When
        ResponseStatusException result = RoomControllerErrorHandler.mapException(
            exception, "/api/rooms/test");

        // Then
        assertEquals(HttpStatus.FORBIDDEN, result.getStatusCode());
        assertNotNull(result.getReason());
        assertTrue(result.getReason().contains("Forbidden"));
    }

    @Test
    void testMapNoSuchElementException() {
        // Given
        NoSuchElementException exception = new NoSuchElementException("Room not found");

        // When
        ResponseStatusException result = RoomControllerErrorHandler.mapException(
            exception, "/api/rooms/test");

        // Then
        assertEquals(HttpStatus.NOT_FOUND, result.getStatusCode());
        assertNotNull(result.getReason());
        assertTrue(result.getReason().contains("NotFound"));
    }

    @Test
    void testMapIllegalArgumentException() {
        // Given
        IllegalArgumentException exception = new IllegalArgumentException("Invalid temperature");

        // When
        ResponseStatusException result = RoomControllerErrorHandler.mapException(
            exception, "/api/rooms/test");

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, result.getStatusCode());
        assertNotNull(result.getReason());
        assertTrue(result.getReason().contains("ValidationError"));
    }

    @Test
    void testMapGenericException() {
        // Given
        RuntimeException exception = new RuntimeException("Unexpected error");

        // When
        ResponseStatusException result = RoomControllerErrorHandler.mapException(
            exception, "/api/rooms/test");

        // Then
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, result.getStatusCode());
        assertNotNull(result.getReason());
        assertTrue(result.getReason().contains("InternalServerError"));
    }

    @Test
    void testMapQuotaRelatedErrorByMessage() {
        // Given
        RuntimeException exception = new RuntimeException("Quota limit exceeded for user");

        // When
        ResponseStatusException result = RoomControllerErrorHandler.mapException(
            exception, "/api/rooms/test");

        // Then
        assertEquals(HttpStatus.FORBIDDEN, result.getStatusCode());
        assertNotNull(result.getReason());
        assertTrue(result.getReason().contains("QuotaExceeded"));
    }

    @Test
    void testMapDeviceRelatedErrorByMessage() {
        // Given
        RuntimeException exception = new RuntimeException("MQTT connection failed");

        // When
        ResponseStatusException result = RoomControllerErrorHandler.mapException(
            exception, "/api/rooms/test");

        // Then
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, result.getStatusCode());
        assertNotNull(result.getReason());
        assertTrue(result.getReason().contains("DeviceUnavailable"));
    }

    @Test
    void testPreserveExistingResponseStatusException() {
        // Given
        ResponseStatusException exception = new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "Custom error message");

        // When
        ResponseStatusException result = RoomControllerErrorHandler.mapException(
            exception, "/api/rooms/test");

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, result.getStatusCode());
        assertNotNull(result.getReason());
    }
}