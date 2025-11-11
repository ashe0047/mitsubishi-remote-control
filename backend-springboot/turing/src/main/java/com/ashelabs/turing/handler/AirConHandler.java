package com.ashelabs.turing.handler;

import com.ashelabs.turing.config.JwtAuthenticationContext;
import com.ashelabs.turing.dto.AirConSettings;
import com.ashelabs.turing.service.ReactiveAirConService;
import com.ashelabs.turing.service.QuotaAwareAirConService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;

import java.util.UUID;

@Slf4j
@Component
public class AirConHandler {

    private final ReactiveAirConService airConService;
    private final QuotaAwareAirConService quotaAwareAirConService;
    private final JwtAuthenticationContext jwtAuthContext;

    @Autowired
    public AirConHandler(
            ReactiveAirConService airConService,
            QuotaAwareAirConService quotaAwareAirConService,
            JwtAuthenticationContext jwtAuthContext) {
        this.airConService = airConService;
        this.quotaAwareAirConService = quotaAwareAirConService;
        this.jwtAuthContext = jwtAuthContext;
    }

    /**
     * Get all rooms
     * GET /api/rooms
     */
    public Mono<ServerResponse> getRooms(ServerRequest request) {
        log.info("WebFlux: Getting all rooms");

        return airConService.getRooms()
                .flatMap(rooms -> {
                    log.info("WebFlux: Successfully returned {} rooms", rooms.size());
                    return ServerResponse.ok()
                            .contentType(MediaType.APPLICATION_JSON)
                            .bodyValue(rooms);
                })
                .onErrorResume(this::handleError);
    }

    /**
     * Get room state
     * GET /api/rooms/{roomId}/state
     */
    public Mono<ServerResponse> getRoomState(ServerRequest request) {
        String roomId = request.pathVariable("roomId");
        log.info("WebFlux: Getting state for room: {}", roomId);

        return airConService.getRoomState(roomId)
                .flatMap(state -> ServerResponse.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(state))
                .switchIfEmpty(ServerResponse.notFound().build())
                .doOnSuccess(response -> log.debug("WebFlux: Successfully returned state for room: {}", roomId))
                .onErrorResume(this::handleError);
    }

    /**
     * Get room settings
     * GET /api/rooms/{roomId}/settings
     */
    public Mono<ServerResponse> getRoomSettings(ServerRequest request) {
        String roomId = request.pathVariable("roomId");
        log.info("WebFlux: Getting settings for room: {}", roomId);

        return airConService.getRoomSettings(roomId)
                .flatMap(settings -> ServerResponse.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(settings))
                .switchIfEmpty(ServerResponse.notFound().build())
                .doOnSuccess(response -> log.debug("WebFlux: Successfully returned settings for room: {}", roomId))
                .onErrorResume(this::handleError);
    }

    /**
     * Set power state
     * POST /api/rooms/{roomId}/power
     */
    public Mono<ServerResponse> setPower(ServerRequest request) {
        String roomId = request.pathVariable("roomId");
        log.info("WebFlux: Setting power for room: {}", roomId);

        return request.bodyToMono(String.class)
                .flatMap(power ->
                    executeWithQuotaAwareness(request, roomId,
                        (userId) -> quotaAwareAirConService.setPower(userId, roomId, power),
                        () -> airConService.setPower(roomId, power)
                    )
                )
                .then(ServerResponse.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue("{\"message\":\"Power command sent\"}"))
                .doOnSuccess(response -> log.info("WebFlux: Power command completed for room: {}", roomId))
                .onErrorResume(this::handleError);
    }

    /**
     * Set temperature
     * POST /api/rooms/{roomId}/temperature
     */
    public Mono<ServerResponse> setTemperature(ServerRequest request) {
        String roomId = request.pathVariable("roomId");
        log.info("WebFlux: Setting temperature for room: {}", roomId);

        return request.bodyToMono(String.class)
                .map(Integer::parseInt)
                .flatMap(temperature ->
                    executeWithQuotaAwareness(request, roomId,
                        (userId) -> quotaAwareAirConService.setTemperature(userId, roomId, temperature),
                        () -> airConService.setTemperature(roomId, temperature)
                    )
                )
                .then(ServerResponse.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue("{\"message\":\"Temperature command sent\"}"))
                .doOnSuccess(response -> log.info("WebFlux: Temperature command completed for room: {}", roomId))
                .onErrorResume(NumberFormatException.class,
                        error -> ServerResponse.badRequest()
                                .contentType(MediaType.APPLICATION_JSON)
                                .bodyValue("{\"error\":\"Invalid temperature format\"}"))
                .onErrorResume(this::handleError);
    }

    /**
     * Set mode
     * POST /api/rooms/{roomId}/mode
     */
    public Mono<ServerResponse> setMode(ServerRequest request) {
        String roomId = request.pathVariable("roomId");
        log.info("WebFlux: Setting mode for room: {}", roomId);

        return request.bodyToMono(String.class)
                .flatMap(mode ->
                    executeWithQuotaAwareness(request, roomId,
                        (userId) -> quotaAwareAirConService.setMode(userId, roomId, mode),
                        () -> airConService.setMode(roomId, mode)
                    )
                )
                .then(ServerResponse.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue("{\"message\":\"Mode command sent\"}"))
                .doOnSuccess(response -> log.info("WebFlux: Mode command completed for room: {}", roomId))
                .onErrorResume(this::handleError);
    }

    /**
     * Set fan speed
     * POST /api/rooms/{roomId}/fan
     */
    public Mono<ServerResponse> setFan(ServerRequest request) {
        String roomId = request.pathVariable("roomId");
        log.info("WebFlux: Setting fan for room: {}", roomId);

        return request.bodyToMono(String.class)
                .flatMap(fan ->
                    executeWithQuotaAwareness(request, roomId,
                        (userId) -> quotaAwareAirConService.setFan(userId, roomId, fan),
                        () -> airConService.setFan(roomId, fan)
                    )
                )
                .then(ServerResponse.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue("{\"message\":\"Fan command sent\"}"))
                .doOnSuccess(response -> log.info("WebFlux: Fan command completed for room: {}", roomId))
                .onErrorResume(this::handleError);
    }

    /**
     * Set vane position
     * POST /api/rooms/{roomId}/vane
     */
    public Mono<ServerResponse> setVane(ServerRequest request) {
        String roomId = request.pathVariable("roomId");
        log.info("WebFlux: Setting vane for room: {}", roomId);

        return request.bodyToMono(String.class)
                .flatMap(vane ->
                    executeWithQuotaAwareness(request, roomId,
                        (userId) -> quotaAwareAirConService.setVane(userId, roomId, vane),
                        () -> airConService.setVane(roomId, vane)
                    )
                )
                .then(ServerResponse.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue("{\"message\":\"Vane command sent\"}"))
                .doOnSuccess(response -> log.info("WebFlux: Vane command completed for room: {}", roomId))
                .onErrorResume(this::handleError);
    }

    /**
     * Set wide vane position
     * POST /api/rooms/{roomId}/widevane
     */
    public Mono<ServerResponse> setWideVane(ServerRequest request) {
        String roomId = request.pathVariable("roomId");
        log.info("WebFlux: Setting wide vane for room: {}", roomId);

        return request.bodyToMono(String.class)
                .flatMap(wideVane ->
                    executeWithQuotaAwareness(request, roomId,
                        (userId) -> quotaAwareAirConService.setWideVane(userId, roomId, wideVane),
                        () -> airConService.setWideVane(roomId, wideVane)
                    )
                )
                .then(ServerResponse.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue("{\"message\":\"Wide vane command sent\"}"))
                .doOnSuccess(response -> log.info("WebFlux: Wide vane command completed for room: {}", roomId))
                .onErrorResume(this::handleError);
    }

    /**
     * Update all settings
     * PUT /api/rooms/{roomId}/settings
     */
    public Mono<ServerResponse> updateSettings(ServerRequest request) {
        String roomId = request.pathVariable("roomId");
        log.info("WebFlux: Updating settings for room: {}", roomId);

        return request.bodyToMono(AirConSettings.class)
                .flatMap(settings ->
                    executeWithQuotaAwareness(request, roomId,
                        (userId) -> quotaAwareAirConService.updateSettings(userId, roomId, settings),
                        () -> airConService.updateSettings(roomId, settings)
                    )
                )
                .then(ServerResponse.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue("{\"message\":\"Settings updated\"}"))
                .doOnSuccess(response -> log.info("WebFlux: Settings update completed for room: {}", roomId))
                .onErrorResume(this::handleError);
    }

    /**
     * Get MQTT connection status
     * GET /api/rooms/mqtt/status
     */
    public Mono<ServerResponse> getMqttStatus(ServerRequest request) {
        log.info("WebFlux: Getting MQTT connection status");

        return airConService.isMqttConnected()
                .flatMap(connected -> ServerResponse.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(connected))
                .doOnSuccess(response -> log.debug("WebFlux: Successfully returned MQTT status"))
                .onErrorResume(this::handleError);
    }

    /**
     * Global error handler for all endpoints
     */
    private Mono<ServerResponse> handleError(Throwable error) {
        log.error("WebFlux handler error", error);

        // Handle quota exceeded errors
        if (error instanceof QuotaAwareAirConService.QuotaExceededException) {
            return ServerResponse.status(HttpStatus.FORBIDDEN)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue("{\"error\":\"" + error.getMessage() + "\",\"code\":\"QUOTA_EXCEEDED\"}");
        }

        if (error instanceof IllegalArgumentException) {
            return ServerResponse.badRequest()
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue("{\"error\":\"" + error.getMessage() + "\"}");
        }

        return ServerResponse.status(500)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue("{\"error\":\"Internal server error\"}");
    }

    /**
     * Helper method to execute commands with quota awareness when user context is available.
     *
     * This method tries to extract user context from the Authorization header. If successful,
     * it uses the quota-aware service. If not, it falls back to the basic service for
     * backward compatibility.
     *
     * @param request the incoming server request
     * @param roomId the room ID for logging context
     * @param quotaAwareExecution function to execute with user context
     * @param fallbackExecution function to execute without user context
     * @return Mono that completes when command is executed
     */
    private Mono<Void> executeWithQuotaAwareness(
            ServerRequest request,
            String roomId,
            java.util.function.Function<UUID, Mono<Void>> quotaAwareExecution,
            java.util.function.Supplier<Mono<Void>> fallbackExecution) {

        // Try to extract user context from Authorization header
        return request.headers()
                .header("Authorization")
                .stream()
                .findFirst()
                .map(authHeader -> {
                    log.debug("Found Authorization header for room {}, attempting quota-aware execution", roomId);

                    return jwtAuthContext.extractUserFromToken(authHeader)
                        .flatMap(userInfo -> {
                            log.debug("Extracted user context: {} for room {}", userInfo.getEmail(), roomId);
                            return quotaAwareExecution.apply(userInfo.getUserId());
                        })
                        .onErrorResume(error -> {
                            log.debug("Failed to extract user context for room {} - falling back to basic service: {}",
                                roomId, error.getMessage());
                            return fallbackExecution.get();
                        });
                })
                .orElseGet(() -> {
                    log.debug("No Authorization header found for room {} - using basic service", roomId);
                    return fallbackExecution.get();
                });
    }
}