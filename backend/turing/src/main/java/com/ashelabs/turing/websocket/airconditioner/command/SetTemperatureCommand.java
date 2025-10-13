package com.ashelabs.turing.websocket.airconditioner.command;

import com.ashelabs.turing.application.device.DeviceService;
import com.ashelabs.turing.domain.device.DeviceType;
import com.ashelabs.turing.websocket.airconditioner.messages.inbound.SetTemperatureMessage;
import com.ashelabs.turing.websocket.core.WebSocketCommand;
import com.ashelabs.turing.websocket.core.WebSocketContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.util.UUID;

/**
 * Command to handle temperature setting requests for air conditioners.
 *
 * <p>Validates temperature range (16-30°C) and delegates to DeviceService.
 * Uses device-room integration to route commands via protocol-agnostic identifiers.
 *
 * <p><strong>Single Responsibility</strong>: Handle SET_TEMPERATURE messages only.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SetTemperatureCommand implements WebSocketCommand<SetTemperatureMessage> {

    private static final double MIN_TEMPERATURE = 16.0;
    private static final double MAX_TEMPERATURE = 30.0;

    private final DeviceService deviceService;

    @Override
    public Mono<Void> execute(SetTemperatureMessage message, WebSocketContext context) {
        return Mono.defer(() -> {
            double temperature = message.temperature();
            String roomId = context.roomId();

            log.debug("Setting temperature to {}°C for room {}", temperature, roomId);

            // Validate temperature range
            if (temperature < MIN_TEMPERATURE || temperature > MAX_TEMPERATURE) {
                log.warn("Temperature {} out of range [16-30] for room {}", temperature, roomId);
                return Mono.error(new IllegalArgumentException(
                    String.format("Temperature %.1f°C out of range [%.1f-%.1f]",
                        temperature, MIN_TEMPERATURE, MAX_TEMPERATURE)
                ));
            }

            // Get first enabled AC device for room and send command
            return deviceService.getEnabledDevicesByRoom(UUID.fromString(roomId))
                .filter(device -> device.deviceType() == DeviceType.AIRCONDITIONER)
                .next()  // Get first AC device
                .flatMap(device -> {
                    String deviceIdentifier = device.deviceIdentifier().value();
                    return deviceService.setDeviceTemperature(deviceIdentifier, (int) Math.round(temperature));
                })
                .doOnSuccess(v -> log.info("Successfully set temperature to {}°C for room {}", temperature, roomId))
                .switchIfEmpty(Mono.error(new IllegalStateException("No enabled AC device found for room: " + roomId)));
        })
        .doOnError(e -> log.error("Failed to set temperature for room {}", context.roomId(), e))
        .onErrorResume(e -> Mono.empty()); // Don't crash connection on error
    }

    @Override
    public boolean canHandle(Object message) {
        return message instanceof SetTemperatureMessage;
    }
}
