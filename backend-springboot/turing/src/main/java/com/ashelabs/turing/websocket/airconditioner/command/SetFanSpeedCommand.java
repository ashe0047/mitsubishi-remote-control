package com.ashelabs.turing.websocket.airconditioner.command;

import com.ashelabs.turing.application.device.DeviceService;
import com.ashelabs.turing.domain.device.DeviceType;
import com.ashelabs.turing.websocket.airconditioner.messages.inbound.SetFanSpeedMessage;
import com.ashelabs.turing.websocket.core.WebSocketCommand;
import com.ashelabs.turing.websocket.core.WebSocketContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.util.Set;
import java.util.UUID;

/**
 * Command to handle air conditioner fan speed setting requests.
 *
 * <p>Validates fan speed against allowed values and delegates to DeviceService.
 * Uses device-room integration to route commands via protocol-agnostic identifiers.
 *
 * <p><strong>Single Responsibility</strong>: Handle SET_FAN_SPEED messages only.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SetFanSpeedCommand implements WebSocketCommand<SetFanSpeedMessage> {

    private static final Set<String> VALID_FAN_SPEEDS = Set.of(
        "low", "medium", "high", "auto", "quiet"
    );

    private final DeviceService deviceService;

    @Override
    public Mono<Void> execute(SetFanSpeedMessage message, WebSocketContext context) {
        return Mono.defer(() -> {
            String fanSpeed = message.fanSpeed();
            String roomId = context.roomId();

            log.debug("Setting fan speed to {} for room {}", fanSpeed, roomId);

            // Validate fan speed
            if (!VALID_FAN_SPEEDS.contains(fanSpeed.toLowerCase())) {
                log.warn("Invalid fan speed '{}' for room {}", fanSpeed, roomId);
                return Mono.error(new IllegalArgumentException(
                    String.format("Invalid fan speed '%s'. Valid speeds: %s", fanSpeed, VALID_FAN_SPEEDS)
                ));
            }

            // Get first enabled AC device for room and send command
            return deviceService.getEnabledDevicesByRoom(UUID.fromString(roomId))
                .filter(device -> device.deviceType() == DeviceType.AIRCONDITIONER)
                .next()
                .flatMap(device -> {
                    String deviceIdentifier = device.deviceIdentifier().value();
                    return deviceService.setDeviceFanSpeed(deviceIdentifier, fanSpeed);
                })
                .doOnSuccess(v -> log.info("Successfully set fan speed to {} for room {}", fanSpeed, roomId))
                .switchIfEmpty(Mono.error(new IllegalStateException("No enabled AC device found for room: " + roomId)));
        })
        .doOnError(e -> log.error("Failed to set fan speed for room {}", context.roomId(), e))
        .onErrorResume(e -> Mono.empty());
    }

    @Override
    public boolean canHandle(Object message) {
        return message instanceof SetFanSpeedMessage;
    }
}
