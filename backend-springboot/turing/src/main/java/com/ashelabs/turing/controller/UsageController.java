package com.ashelabs.turing.controller;

import com.ashelabs.turing.config.JwtAuthenticationContext;
import com.ashelabs.turing.entity.UsageSession;
import com.ashelabs.turing.repository.UsageSessionRepository;
import com.ashelabs.turing.service.UsageTrackingService;
import com.ashelabs.turing.service.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Map;
import java.util.UUID;

/**
 * REST Controller for usage tracking and analytics.
 * Handles usage history, session management, and analytics.
 */
@RestController
@RequestMapping("/api/usage")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:3001" })
public class UsageController {

    private final UsageTrackingService usageTrackingService;
    private final UsageSessionRepository usageSessionRepository;
    private final JwtAuthenticationContext jwtAuthContext;

    /**
     * Get usage summary for a user
     * GET /api/usage/summary/{userId}?startDate=yyyy-mm-dd&endDate=yyyy-mm-dd
     */
    @GetMapping("/summary/{userId}")
    public Mono<ResponseEntity<UsageSummaryResponse>> getUsageSummary(
            @PathVariable String userId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flatMap(userInfo -> {

                    log.info("Getting usage summary for user {} from {} to {} requested by {}",
                            userId, startDate, endDate, userInfo.getEmail());

                    try {
                        LocalDate start = startDate != null ? LocalDate.parse(startDate) : LocalDate.now().minusDays(7);
                        LocalDate end = endDate != null ? LocalDate.parse(endDate) : LocalDate.now();

                        return usageSessionRepository.findSessionsByDateRange(
                                UUID.fromString(userId), start.atStartOfDay(), end.plusDays(1).atStartOfDay())
                                .collectList()
                                .map(sessions -> {
                                    UsageSummaryResponse summary = createUsageSummary(sessions, start, end);
                                    return ResponseEntity.ok(summary);
                                })
                                .doOnSuccess(response -> log.info("Usage summary retrieved for user {}", userId))
                                .onErrorResume(error -> {
                                    log.error("Error getting usage summary for user {}", userId, error);
                                return Mono.just(ResponseEntity.badRequest().<UsageSummaryResponse>build());
                            });

                    } catch (DateTimeParseException e) {
                        log.warn("Invalid date format in request: startDate={}, endDate={}", startDate, endDate);
                        return Mono.just(ResponseEntity.badRequest().<UsageSummaryResponse>build());
                    }
                })
                .onErrorResume(ResponseStatusException.class,
                        error -> Mono.just((ResponseEntity<UsageSummaryResponse>) (ResponseEntity<?>) ResponseEntity.status(error.getStatusCode()).build()));
    }

    /**
     * Get detailed usage sessions for a user
     * GET /api/usage/sessions/{userId}?roomId=room123&limit=50
     */
    @GetMapping("/sessions/{userId}")
    public Flux<UsageSession> getUsageSessions(
            @PathVariable String userId,
            @RequestParam(required = false) String roomId,
            @RequestParam(required = false, defaultValue = "50") int limit,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flux()
                .filter(userInfo -> userInfo != null)
                .doOnNext(userInfo -> log.info("Getting usage sessions for user {}, room {}, limit {} requested by {}",
                        userId, roomId, limit, userInfo.getEmail()))
                .flatMap(userInfo -> {
                    UUID userUuid = UUID.fromString(userId);

                    if (roomId != null) {
                        return usageSessionRepository.findSessionsByRoomAndDateRange(
                                roomId,
                                java.time.LocalDateTime.now().minusDays(365),
                                java.time.LocalDateTime.now()).filter(session -> session.getUserId().equals(userUuid))
                                .take(limit)
                                .doOnNext(session -> log.debug("Found session: {}", session.getId()))
                                .onErrorResume(error -> {
                                    log.error("Error getting usage sessions", error);
                                    return Flux.empty();
                                });
                    } else {
                        return usageSessionRepository.findSessionsByDateRange(
                                userUuid,
                                java.time.LocalDateTime.now().minusDays(365),
                                java.time.LocalDateTime.now())
                                .take(limit)
                                .doOnNext(session -> log.debug("Found session: {}", session.getId()))
                                .onErrorResume(error -> {
                                    log.error("Error getting usage sessions", error);
                                return Flux.empty();
                            });
                    }
                })
                .onErrorResume(ResponseStatusException.class, error -> Flux.error(error));
    }

    /**
     * Get current active sessions for a user
     * GET /api/usage/active/{userId}
     */
    @GetMapping("/active/{userId}")
    public Flux<UsageSession> getActiveSessions(
            @PathVariable String userId,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flux()
                .filter(userInfo -> userInfo != null)
                .doOnNext(userInfo -> log.info("Getting active sessions for user {} requested by {}",
                        userId, userInfo.getEmail()))
                .flatMap(userInfo -> {
                    return usageSessionRepository.findActiveSessionsByUser(UUID.fromString(userId))
                            .doOnNext(session -> log.debug("Found active session: {} in room {}",
                                    session.getId(), session.getRoomId()))
                            .onErrorResume(error -> {
                                log.error("Error getting active sessions for user {}", userId, error);
                                return Flux.empty();
                            });
                })
                .onErrorResume(ResponseStatusException.class, error -> Flux.error(error));
    }

    /**
     * Get usage analytics for household (Parent only)
     * GET /api/usage/household/analytics
     */
    @GetMapping("/household/analytics")
    public Mono<ResponseEntity<HouseholdAnalyticsResponse>> getHouseholdAnalytics(
            @RequestParam(required = false) String period,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flatMap(userInfo -> {

                    log.info("Getting household analytics for user {}, period {} requested by {}",
                            userInfo.getHouseholdId(), period, userInfo.getEmail());

                    // TODO: Implement household analytics
                    // This would aggregate usage across all family members

                    HouseholdAnalyticsResponse analytics = HouseholdAnalyticsResponse.builder()
                            .totalUsers(0)
                            .totalUsageHours(0.0)
                            .mostActiveRoom("N/A")
                            .peakUsageHour("N/A")
                            .build();

                    return Mono.just(ResponseEntity.ok(analytics))
                            .doOnSuccess(response -> log.info("Household analytics retrieved"))
                            .onErrorResume(error -> {
                                log.error("Error getting household analytics", error);
                                return Mono.just(ResponseEntity.internalServerError().build());
                            });
                })
                .onErrorResume(ResponseStatusException.class,
                        error -> Mono.just(ResponseEntity.status(error.getStatusCode()).build()));
    }

    private Mono<JwtService.JwtUserInfo> requireAuthenticatedUser(String authorization) {
        Mono<JwtService.JwtUserInfo> fromContext = jwtAuthContext.currentUser();

        if (StringUtils.hasText(authorization)) {
            return fromContext.switchIfEmpty(jwtAuthContext.extractUserFromToken(authorization));
        }

        return fromContext.switchIfEmpty(
                Mono.error(new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authorization required")));
    }

    // Helper methods

    private UsageSummaryResponse createUsageSummary(java.util.List<UsageSession> sessions,
            LocalDate startDate, LocalDate endDate) {

        int totalSessions = sessions.size();
        double totalHours = sessions.stream()
                .mapToDouble(
                        session -> session.getDurationMinutes() != null ? session.getDurationMinutes() / 60.0 : 0.0)
                .sum();

        double averageSessionLength = totalSessions > 0 ? totalHours / totalSessions : 0.0;

        // Group by room
        Map<String, Integer> roomUsage = sessions.stream()
                .collect(java.util.stream.Collectors.groupingBy(
                        UsageSession::getRoomId,
                        java.util.stream.Collectors.summingInt(
                                session -> session.getDurationMinutes() != null ? session.getDurationMinutes() : 0)));

        String mostUsedRoom = roomUsage.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("N/A");

        return UsageSummaryResponse.builder()
                .startDate(startDate.toString())
                .endDate(endDate.toString())
                .totalSessions(totalSessions)
                .totalHours(Math.round(totalHours * 100.0) / 100.0)
                .averageSessionLength(Math.round(averageSessionLength * 100.0) / 100.0)
                .mostUsedRoom(mostUsedRoom)
                .roomBreakdown(roomUsage)
                .build();
    }

    // Response DTOs

    @lombok.Builder
    @lombok.Data
    public static class UsageSummaryResponse {
        private String startDate;
        private String endDate;
        private int totalSessions;
        private double totalHours;
        private double averageSessionLength;
        private String mostUsedRoom;
        private Map<String, Integer> roomBreakdown;
    }

    @lombok.Builder
    @lombok.Data
    public static class HouseholdAnalyticsResponse {
        private int totalUsers;
        private double totalUsageHours;
        private String mostActiveRoom;
        private String peakUsageHour;
    }
}
