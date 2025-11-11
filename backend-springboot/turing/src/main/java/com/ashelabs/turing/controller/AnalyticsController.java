package com.ashelabs.turing.controller;

import com.ashelabs.turing.config.JwtAuthenticationContext;
import com.ashelabs.turing.repository.UsageSessionRepository;
import com.ashelabs.turing.repository.QuotaRepository;
import com.ashelabs.turing.service.JwtService;
import com.ashelabs.turing.entity.UsageSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.UUID;

/**
 * REST Controller for analytics and reporting operations.
 * Provides usage statistics, quota analysis, and household reporting.
 */
@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001"}) // Allow frontend origins
public class AnalyticsController {

    private final UsageSessionRepository usageSessionRepository;
    private final QuotaRepository quotaRepository;
    private final JwtAuthenticationContext jwtAuthContext;

    /**
     * Get usage statistics for a user over a specific period
     * GET /api/analytics/user/{userId}/usage?startDate={date}&endDate={date}&roomId={roomId}
     */
    @GetMapping("/user/{userId}/usage")
    public Mono<ResponseEntity<Map<String, Object>>> getUserUsageStatistics(
            @PathVariable String userId,
            @RequestParam String startDate,
            @RequestParam String endDate,
            @RequestParam(required = false) String roomId,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flatMap(userInfo -> {

                    log.info("Getting usage statistics for user {} from {} to {} requested by {}",
                        userId, startDate, endDate, userInfo.getEmail());

                    try {
                        LocalDateTime start = LocalDateTime.parse(startDate + "T00:00:00");
                        LocalDateTime end = LocalDateTime.parse(endDate + "T23:59:59");
                        UUID userUuid = UUID.fromString(userId);

                        // Get basic usage statistics
                        Mono<Map<String, Object>> basicStats = usageSessionRepository.getUsageStatistics(userUuid, start, end)
                            .cast(Map.class)
                            .map(map -> (Map<String, Object>) map)
                            .onErrorReturn(Map.of());

                        // Get daily usage breakdown
                        Mono<Long> dailyUsage = usageSessionRepository.calculateDailyUsage(userUuid, start.toLocalDate());

                        // Get sessions for the period
                        Flux<UsageSession> sessions = roomId != null
                            ? usageSessionRepository.findSessionsByRoomAndDateRange(roomId, start, end)
                            : usageSessionRepository.findSessionsByDateRange(userUuid, start, end);

                        return Mono.zip(basicStats, dailyUsage, sessions.collectList())
                            .map(tuple -> {
                                Map<String, Object> stats = tuple.getT1();
                                Long todayUsage = tuple.getT2();
                                var sessionList = tuple.getT3();

                                Map<String, Object> response = Map.of(
                                    "userId", userId,
                                    "period", Map.of("start", startDate, "end", endDate),
                                    "roomId", roomId != null ? roomId : "all",
                                    "statistics", stats,
                                    "todayUsageSeconds", todayUsage,
                                    "sessions", sessionList,
                                    "generatedAt", LocalDateTime.now().toString()
                                );

                                return ResponseEntity.ok(response);
                            });

                    } catch (Exception e) {
                        log.error("Error parsing dates or processing statistics", e);
                        return Mono.just(ResponseEntity.badRequest().<Map<String, Object>>build());
                    }
                })
                .onErrorResume(ResponseStatusException.class,
                        error -> Mono.just(ResponseEntity.status(error.getStatusCode()).build()))
                .onErrorResume(error -> {
                    log.error("Error getting usage statistics for user {}", userId, error);
                    if (error instanceof RuntimeException && error.getMessage().contains("token")) {
                        return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).<Map<String, Object>>build());
                    }
                    return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).<Map<String, Object>>build());
                });
    }

    /**
     * Get usage trends for a user (weekly and monthly summaries)
     * GET /api/analytics/user/{userId}/trends
     */
    @GetMapping("/user/{userId}/trends")
    public Mono<ResponseEntity<Map<String, Object>>> getUserUsageTrends(
            @PathVariable String userId,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flatMap(userInfo -> {

                    log.info("Getting usage trends for user {} requested by {}", userId, userInfo.getEmail());

                    try {
                        UUID userUuid = UUID.fromString(userId);
                        LocalDateTime now = LocalDateTime.now();
                        LocalDateTime weekStart = now.minusDays(7);
                        LocalDateTime monthStart = now.minusDays(30);

                        // Get weekly and monthly usage
                        Mono<Long> weeklyUsage = usageSessionRepository.calculateWeeklyUsage(userUuid, weekStart);
                        Mono<Long> monthlyUsage = usageSessionRepository.calculateMonthlyUsage(userUuid, monthStart);
                        Mono<Long> todayUsage = usageSessionRepository.calculateDailyUsage(userUuid, LocalDate.now());

                        return Mono.zip(weeklyUsage, monthlyUsage, todayUsage)
                            .map(tuple -> {
                                Map<String, Object> trends = Map.of(
                                    "userId", userId,
                                    "todayUsageSeconds", tuple.getT3(),
                                    "weeklyUsageSeconds", tuple.getT1(),
                                    "monthlyUsageSeconds", tuple.getT2(),
                                    "averageDailyUsage", tuple.getT1() / 7.0,
                                    "generatedAt", LocalDateTime.now().toString()
                                );

                                return ResponseEntity.ok(trends);
                            });

                    } catch (Exception e) {
                        log.error("Error processing usage trends", e);
                        return Mono.just(ResponseEntity.badRequest().<Map<String, Object>>build());
                    }
                })
                .onErrorResume(ResponseStatusException.class,
                        error -> Mono.just(ResponseEntity.status(error.getStatusCode()).build()))
                .onErrorResume(error -> {
                    log.error("Error getting usage trends for user {}", userId, error);
                    return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).<Map<String, Object>>build());
                });
    }

    /**
     * Get household usage summary (for parents to monitor family usage)
     * GET /api/analytics/household/usage
     */
    @GetMapping("/household/usage")
    public Mono<ResponseEntity<Map<String, Object>>> getHouseholdUsage(
            @RequestParam(required = false, defaultValue = "7") int days,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flatMap(userInfo -> {
                    if (!jwtAuthContext.isParent(userInfo)) {
                        return Mono.just(ResponseEntity.status(HttpStatus.FORBIDDEN).build());
                    }

                    log.info("Getting household usage summary for {} days requested by {}", days, userInfo.getEmail());

                    UUID householdId = userInfo.getHouseholdId();
                    if (householdId == null) {
                        return Mono.just(ResponseEntity.badRequest().<Map<String, Object>>build());
                    }

                    // Get household sessions
                    Flux<UsageSession> householdSessions = usageSessionRepository.findSessionsByHousehold(householdId);

                    // Filter to last N days and collect statistics
                    LocalDateTime cutoff = LocalDateTime.now().minusDays(days);

                    return householdSessions
                        .filter(session -> session.getStartedAt().isAfter(cutoff.toInstant(java.time.ZoneOffset.UTC)))
                        .collectList()
                        .map(sessions -> {
                            // Group by user and calculate totals
                            Map<UUID, Long> userUsage = sessions.stream()
                                .collect(java.util.stream.Collectors.groupingBy(
                                    UsageSession::getUserId,
                                    java.util.stream.Collectors.summingLong(session ->
                                        session.getDurationMinutes() != null ? session.getDurationMinutes() * 60L : 0L)
                                ));

                            // Group by room
                            Map<String, Long> roomUsage = sessions.stream()
                                .collect(java.util.stream.Collectors.groupingBy(
                                    UsageSession::getRoomId,
                                    java.util.stream.Collectors.summingLong(session ->
                                        session.getDurationMinutes() != null ? session.getDurationMinutes() * 60L : 0L)
                                ));

                            long totalUsageSeconds = userUsage.values().stream().mapToLong(Long::longValue).sum();

                            Map<String, Object> summary = Map.of(
                                "householdId", householdId.toString(),
                                "periodDays", days,
                                "totalUsageSeconds", totalUsageSeconds,
                                "totalSessions", sessions.size(),
                                "userUsage", userUsage,
                                "roomUsage", roomUsage,
                            "generatedAt", LocalDateTime.now().toString()
                        );

                        return ResponseEntity.ok(summary);
                    });
                })
                .onErrorResume(ResponseStatusException.class,
                        error -> Mono.just(ResponseEntity.status(error.getStatusCode()).build()))
                .onErrorResume(error -> {
                    log.error("Error getting household usage summary", error);
                    return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).<Map<String, Object>>build());
                })
                .map(response -> (ResponseEntity<Map<String, Object>>) response);
    }

    /**
     * Get quota utilization report
     * GET /api/analytics/quota/utilization?userId={userId}&period={period}
     */
    @GetMapping("/quota/utilization")
    public Mono<ResponseEntity<Map<String, Object>>> getQuotaUtilization(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false, defaultValue = "daily") String period,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flatMap(userInfo -> {

                    // If userId not provided, use requesting user's ID
                    String targetUserId = userId != null ? userId : userInfo.getUserId().toString();

                    log.info("Getting quota utilization for user {} ({} period) requested by {}",
                        targetUserId, period, userInfo.getEmail());

                    try {
                        UUID userUuid = UUID.fromString(targetUserId);

                        // Get user's quotas
                        Flux<com.ashelabs.turing.entity.Quota> userQuotas = quotaRepository.findQuotasByUser(userUuid);

                        return userQuotas.collectList()
                            .flatMap(quotas -> {
                                if (quotas.isEmpty()) {
                                    Map<String, Object> response = Map.of(
                                        "userId", targetUserId,
                                        "period", period,
                                        "quotas", java.util.List.of(),
                                        "message", "No quotas found for user",
                                        "generatedAt", LocalDateTime.now().toString()
                                    );
                                    return Mono.just(ResponseEntity.ok(response));
                                }

                                // Calculate utilization for each quota
                                java.util.List<Mono<Map<String, Object>>> quotaAnalysis = quotas.stream()
                                    .map(quota -> {
                                        LocalDate today = LocalDate.now();
                                        return usageSessionRepository.calculateDailyUsageByRoom(userUuid, quota.getTargetId(), today)
                                            .map(usageSeconds -> {
                                                double allowedSeconds = quota.getAllowedAmount().doubleValue();
                                                double utilizationPercent = allowedSeconds > 0 ? (usageSeconds / allowedSeconds) * 100 : 0;

                                                return Map.<String, Object>of(
                                                    "quotaId", quota.getId().toString(),
                                                    "roomId", quota.getTargetId(),
                                                    "quotaType", quota.getQuotaType().toString(),
                                                    "allowedSeconds", allowedSeconds,
                                                    "usedSeconds", (double) usageSeconds,
                                                    "utilizationPercent", Math.round(utilizationPercent * 100.0) / 100.0,
                                                    "status", quota.getStatus().toString(),
                                                    "isExceeded", usageSeconds > allowedSeconds
                                                );
                                            });
                                    })
                                    .toList();

                                return Flux.merge(quotaAnalysis)
                                    .collectList()
                                    .map(quotaDetails -> {
                                        Map<String, Object> response = Map.of(
                                            "userId", targetUserId,
                                            "period", period,
                                            "quotas", quotaDetails,
                                            "totalQuotas", quotas.size(),
                                            "generatedAt", LocalDateTime.now().toString()
                                        );
                                        return ResponseEntity.ok(response);
                                    });
                            });

                    } catch (Exception e) {
                        log.error("Error processing quota utilization", e);
                        return Mono.just(ResponseEntity.badRequest().<Map<String, Object>>build());
                    }
                })
                .onErrorResume(ResponseStatusException.class,
                        error -> Mono.just(ResponseEntity.status(error.getStatusCode()).build()))
                .onErrorResume(error -> {
                    log.error("Error getting quota utilization", error);
                    return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).<Map<String, Object>>build());
                });
    }

    /**
     * Get system-wide analytics (admin only)
     * GET /api/analytics/system/overview
     */
    @GetMapping("/system/overview")
    public Mono<ResponseEntity<Map<String, Object>>> getSystemOverview(
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        return requireAuthenticatedUser(authorization)
                .doOnError(error -> log.warn("Failed to extract user from token: {}", error.getMessage()))
                .flatMap(userInfo -> {
                    if (!jwtAuthContext.isParent(userInfo)) {
                        return Mono.just(ResponseEntity.status(HttpStatus.FORBIDDEN).build());
                    }

                    log.info("Getting system overview requested by {}", userInfo.getEmail());

                    // Get system-wide statistics
                    Mono<Long> activeSessionCount = usageSessionRepository.countActiveSessions();
                    Mono<Long> totalQuotaCount = quotaRepository.count();

                    return Mono.zip(activeSessionCount, totalQuotaCount)
                        .map(tuple -> {
                            Map<String, Object> overview = Map.of(
                                "activeSessionsCount", tuple.getT1(),
                                "totalQuotasCount", tuple.getT2(),
                                "systemStatus", "operational",
                                "generatedAt", LocalDateTime.now().toString(),
                                "generatedBy", userInfo.getEmail()
                            );

                            return ResponseEntity.ok(overview);
                        });
                })
                .onErrorResume(ResponseStatusException.class,
                        error -> Mono.just(ResponseEntity.status(error.getStatusCode()).build()))
                .onErrorResume(error -> {
                    log.error("Error getting system overview", error);
                    return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).<Map<String, Object>>build());
                })
                .map(response -> (ResponseEntity<Map<String, Object>>) response);
    }

    private Mono<JwtService.JwtUserInfo> requireAuthenticatedUser(String authorization) {
        Mono<JwtService.JwtUserInfo> fromContext = jwtAuthContext.currentUser();

        if (StringUtils.hasText(authorization)) {
            return fromContext.switchIfEmpty(jwtAuthContext.extractUserFromToken(authorization));
        }

        return fromContext.switchIfEmpty(
                Mono.error(new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authorization required")));
    }
}
