package com.ashelabs.turing.websocket.airconditioner.command;

import com.ashelabs.turing.application.device.DeviceService;
import com.ashelabs.turing.domain.device.DeviceType;
import com.ashelabs.turing.websocket.airconditioner.messages.inbound.SetPowerMessage;
import com.ashelabs.turing.websocket.core.WebSocketCommand;
import com.ashelabs.turing.websocket.core.WebSocketContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.util.UUID;

/**
 * Command to handle air conditioner power on/off requests.
 *
 * <p>Delegates to DeviceService to turn AC on or off.
 * Uses device-room integration to route commands via protocol-agnostic identifiers.
 *
 * <p><strong>Single Responsibility</strong>: Handle SET_POWER messages only.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SetPowerCommand implements WebSocketCommand<SetPowerMessage> {

    private final DeviceService deviceService;

    @Override
    public Mono<Void> execute(SetPowerMessage message, WebSocketContext context) {
        return Mono.defer(() -> {
            boolean power = message.power();
            String roomId = context.roomId();

            log.debug("Setting power to {} for room {}", power ? "ON" : "OFF", roomId);

            // Get first enabled AC device for room and send command
            return deviceService.getEnabledDevicesByRoom(UUID.fromString(roomId))
                .filter(device -> device.deviceType() == DeviceType.AIRCONDITIONER)
                .next()
                .flatMap(device -> {
                    String deviceIdentifier = device.deviceIdentifier().value();
                    return deviceService.setDevicePower(deviceIdentifier, power);
                })
                .doOnSuccess(v -> log.info("Successfully set power to {} for room {}", power ? "ON" : "OFF", roomId))
                .switchIfEmpty(Mono.error(new IllegalStateException("No enabled AC device found for room: " + roomId)));
        })
        .doOnError(e -> log.error("Failed to set power for room {}", context.roomId(), e))
        .onErrorResume(e -> Mono.empty());
    }

    @Override
    public boolean canHandle(Object message) {
        return message instanceof SetPowerMessage;
    }
}
