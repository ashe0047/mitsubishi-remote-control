package com.ashelabs.turing.websocket.airconditioner.command;

import com.ashelabs.turing.application.device.DeviceService;
import com.ashelabs.turing.domain.device.DeviceType;
import com.ashelabs.turing.websocket.airconditioner.messages.inbound.SetSwingMessage;
import com.ashelabs.turing.websocket.core.WebSocketCommand;
import com.ashelabs.turing.websocket.core.WebSocketContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.util.Set;
import java.util.UUID;

/**
 * Command to handle air conditioner swing/vane position setting requests.
 *
 * <p>Validates swing position and delegates to DeviceService.
 * Uses device-room integration to route commands via protocol-agnostic identifiers.
 *
 * <p><strong>Single Responsibility</strong>: Handle SET_SWING messages only.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SetSwingCommand implements WebSocketCommand<SetSwingMessage> {

    private static final Set<String> VALID_SWING_POSITIONS = Set.of(
        "auto", "1", "2", "3", "4", "5", "swing"
    );

    private final DeviceService deviceService;

    @Override
    public Mono<Void> execute(SetSwingMessage message, WebSocketContext context) {
        return Mono.defer(() -> {
            String swing = message.swing();
            String roomId = context.roomId();

            log.debug("Setting swing to {} for room {}", swing, roomId);

            // Validate swing position
            if (!VALID_SWING_POSITIONS.contains(swing.toLowerCase())) {
                log.warn("Invalid swing position '{}' for room {}", swing, roomId);
                return Mono.error(new IllegalArgumentException(
                    String.format("Invalid swing position '%s'. Valid positions: %s", swing, VALID_SWING_POSITIONS)
                ));
            }

            // Get first enabled AC device for room and send command
            return deviceService.getEnabledDevicesByRoom(UUID.fromString(roomId))
                .filter(device -> device.deviceType() == DeviceType.AIRCONDITIONER)
                .next()
                .flatMap(device -> {
                    String deviceIdentifier = device.deviceIdentifier().value();
                    return deviceService.setDeviceVanePosition(deviceIdentifier, swing);
                })
                .doOnSuccess(v -> log.info("Successfully set swing to {} for room {}", swing, roomId))
                .switchIfEmpty(Mono.error(new IllegalStateException("No enabled AC device found for room: " + roomId)));
        })
        .doOnError(e -> log.error("Failed to set swing for room {}", context.roomId(), e))
        .onErrorResume(e -> Mono.empty());
    }

    @Override
    public boolean canHandle(Object message) {
        return message instanceof SetSwingMessage;
    }
}
