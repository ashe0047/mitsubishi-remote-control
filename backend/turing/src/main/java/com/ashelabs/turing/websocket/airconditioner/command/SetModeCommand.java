package com.ashelabs.turing.websocket.airconditioner.command;

import com.ashelabs.turing.application.device.DeviceService;
import com.ashelabs.turing.domain.device.DeviceType;
import com.ashelabs.turing.websocket.airconditioner.messages.inbound.SetModeMessage;
import com.ashelabs.turing.websocket.core.WebSocketCommand;
import com.ashelabs.turing.websocket.core.WebSocketContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.util.Set;
import java.util.UUID;

/**
 * Command to handle air conditioner mode setting requests.
 *
 * <p>Validates mode against allowed values and delegates to DeviceService.
 * Uses device-room integration to route commands via protocol-agnostic identifiers.
 *
 * <p><strong>Single Responsibility</strong>: Handle SET_MODE messages only.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SetModeCommand implements WebSocketCommand<SetModeMessage> {

    private static final Set<String> VALID_MODES = Set.of(
        "cool", "heat", "fan", "dry", "auto", "off"
    );

    private final DeviceService deviceService;

    @Override
    public Mono<Void> execute(SetModeMessage message, WebSocketContext context) {
        return Mono.defer(() -> {
            String mode = message.mode();
            String roomId = context.roomId();

            log.debug("Setting mode to {} for room {}", mode, roomId);

            // Validate mode
            if (!VALID_MODES.contains(mode.toLowerCase())) {
                log.warn("Invalid mode '{}' for room {}", mode, roomId);
                return Mono.error(new IllegalArgumentException(
                    String.format("Invalid mode '%s'. Valid modes: %s", mode, VALID_MODES)
                ));
            }

            // Get first enabled AC device for room and send command
            return deviceService.getEnabledDevicesByRoom(UUID.fromString(roomId))
                .filter(device -> device.deviceType() == DeviceType.AIRCONDITIONER)
                .next()
                .flatMap(device -> {
                    String deviceIdentifier = device.deviceIdentifier().value();
                    return deviceService.setDeviceMode(deviceIdentifier, mode);
                })
                .doOnSuccess(v -> log.info("Successfully set mode to {} for room {}", mode, roomId))
                .switchIfEmpty(Mono.error(new IllegalStateException("No enabled AC device found for room: " + roomId)));
        })
        .doOnError(e -> log.error("Failed to set mode for room {}", context.roomId(), e))
        .onErrorResume(e -> Mono.empty());
    }

    @Override
    public boolean canHandle(Object message) {
        return message instanceof SetModeMessage;
    }
}
