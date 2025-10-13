package com.ashelabs.turing.service;

import com.ashelabs.turing.entity.UsageSession;
import com.ashelabs.turing.entity.Quota;
import com.ashelabs.turing.repository.UsageSessionRepository;
import com.ashelabs.turing.repository.QuotaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Flux;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;
import java.util.List;

/**
 * Service for analytics and reporting operations.
 * Provides aggregated data analysis and business intelligence for quota management.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AnalyticsService {

    private final UsageSessionRepository usageSessionRepository;
    private final QuotaRepository quotaRepository;

    /**
     * Generate comprehensive usage insights for a user
     */
    public Mono<Map<String, Object>> generateUserInsights(UUID userId, int analysisDay) {
        log.debug("Generating user insights for user {} over {} days", userId, analysisDay);

        LocalDateTime endDate = LocalDateTime.now();
        LocalDateTime startDate = endDate.minusDays(analysisDay);

        return Mono.zip(
                calculateUsagePatterns(userId, startDate, endDate),
                calculateQuotaCompliance(userId),
                calculateUsageEfficiency(userId, startDate, endDate),
                getPeakUsageHours(userId, startDate, endDate)
            )
            .map(tuple -> Map.of(
                "userId", userId.toString(),
                "analysisperiod", analysisDay,
                "usagePatterns", tuple.getT1(),
                "quotaCompliance", tuple.getT2(),
                "usageEfficiency", tuple.getT3(),
                "peakUsageHours", tuple.getT4(),
                "generatedAt", LocalDateTime.now().toString()
            ))
            .doOnSuccess(insights -> log.info("Generated insights for user {}: {} patterns analyzed", userId, analysisDay))
            .onErrorResume(error -> {
                log.error("Error generating user insights for {}", userId, error);
                return Mono.just(Map.of("error", "Failed to generate insights"));
            });
    }

    /**
     * Calculate usage patterns (frequency, duration trends)
     */
    private Mono<Map<String, Object>> calculateUsagePatterns(UUID userId, LocalDateTime start, LocalDateTime end) {
        return usageSessionRepository.findSessionsByDateRange(userId, start, end)
            .collectList()
            .map(sessions -> {
                if (sessions.isEmpty()) {
                    return Map.of(
                        "totalSessions", 0,
                        "averageSessionMinutes", 0.0,
                        "longestSessionMinutes", 0,
                        "shortestSessionMinutes", 0,
                        "pattern", "no_usage"
                    );
                }

                List<Integer> durations = sessions.stream()
                    .filter(session -> session.getDurationMinutes() != null)
                    .map(UsageSession::getDurationMinutes)
                    .toList();

                if (durations.isEmpty()) {
                    return Map.of(
                        "totalSessions", sessions.size(),
                        "averageSessionMinutes", 0.0,
                        "pattern", "incomplete_sessions"
                    );
                }

                double avgDuration = durations.stream().mapToInt(Integer::intValue).average().orElse(0.0);
                int maxDuration = durations.stream().mapToInt(Integer::intValue).max().orElse(0);
                int minDuration = durations.stream().mapToInt(Integer::intValue).min().orElse(0);

                // Determine usage pattern
                String pattern = determineUsagePattern(sessions.size(), avgDuration, start, end);

                return Map.of(
                    "totalSessions", sessions.size(),
                    "averageSessionMinutes", Math.round(avgDuration * 100.0) / 100.0,
                    "longestSessionMinutes", maxDuration,
                    "shortestSessionMinutes", minDuration,
                    "pattern", pattern,
                    "sessionsPerDay", Math.round((sessions.size() / (double) ChronoUnit.DAYS.between(start.toLocalDate(), end.toLocalDate())) * 100.0) / 100.0
                );
            });
    }

    /**
     * Calculate quota compliance metrics
     */
    private Mono<Map<String, Object>> calculateQuotaCompliance(UUID userId) {
        return quotaRepository.findQuotasByUser(userId)
            .collectList()
            .flatMap(quotas -> {
                if (quotas.isEmpty()) {
                    return Mono.just(Map.of(
                        "hasQuotas", false,
                        "compliance", "no_quotas_defined"
                    ));
                }

                List<Mono<Map<String, Object>>> quotaChecks = quotas.stream()
                    .map(quota -> checkQuotaCompliance(userId, quota))
                    .toList();

                return Flux.merge(quotaChecks)
                    .collectList()
                    .map(complianceList -> {
                        long compliantQuotas = complianceList.stream()
                            .mapToLong(compliance -> (Boolean) compliance.get("isCompliant") ? 1 : 0)
                            .sum();

                        double complianceRate = (double) compliantQuotas / quotas.size() * 100;

                        return Map.of(
                            "hasQuotas", true,
                            "totalQuotas", quotas.size(),
                            "compliantQuotas", compliantQuotas,
                            "complianceRate", Math.round(complianceRate * 100.0) / 100.0,
                            "quotaDetails", complianceList
                        );
                    });
            });
    }

    /**
     * Check individual quota compliance
     */
    private Mono<Map<String, Object>> checkQuotaCompliance(UUID userId, Quota quota) {
        return usageSessionRepository.calculateDailyUsageByRoom(userId, quota.getTargetId(), LocalDate.now())
            .map(usageSeconds -> {
                double allowedSeconds = quota.getAllowedAmount().doubleValue();
                double usagePercent = allowedSeconds > 0 ? (usageSeconds / allowedSeconds) * 100 : 0;
                boolean isCompliant = usageSeconds <= allowedSeconds;

                return Map.of(
                    "quotaId", quota.getId().toString(),
                    "roomId", quota.getTargetId(),
                    "allowedSeconds", allowedSeconds,
                    "usedSeconds", (double) usageSeconds,
                    "usagePercent", Math.round(usagePercent * 100.0) / 100.0,
                    "isCompliant", isCompliant,
                    "status", quota.getStatus().toString()
                );
            });
    }

    /**
     * Calculate usage efficiency metrics
     */
    private Mono<Map<String, Object>> calculateUsageEfficiency(UUID userId, LocalDateTime start, LocalDateTime end) {
        return usageSessionRepository.findSessionsByDateRange(userId, start, end)
            .collectList()
            .map(sessions -> {
                if (sessions.isEmpty()) {
                    return Map.of("efficiency", "no_data");
                }

                // Group by room to analyze efficiency
                Map<String, List<UsageSession>> roomSessions = sessions.stream()
                    .collect(java.util.stream.Collectors.groupingBy(UsageSession::getRoomId));

                Map<String, Object> roomEfficiency = roomSessions.entrySet().stream()
                    .collect(java.util.stream.Collectors.toMap(
                        Map.Entry::getKey,
                        entry -> {
                            List<UsageSession> roomSessionList = entry.getValue();
                            double avgSessionLength = roomSessionList.stream()
                                .filter(session -> session.getDurationMinutes() != null)
                                .mapToInt(UsageSession::getDurationMinutes)
                                .average()
                                .orElse(0.0);

                            return Map.of(
                                "sessionCount", roomSessionList.size(),
                                "averageSessionMinutes", Math.round(avgSessionLength * 100.0) / 100.0,
                                "totalUsageMinutes", roomSessionList.stream()
                                    .filter(session -> session.getDurationMinutes() != null)
                                    .mapToInt(UsageSession::getDurationMinutes)
                                    .sum()
                            );
                        }
                    ));

                return Map.of(
                    "roomBreakdown", roomEfficiency,
                    "totalRoomsUsed", roomSessions.size(),
                    "averageSessionsPerRoom", Math.round((sessions.size() / (double) roomSessions.size()) * 100.0) / 100.0
                );
            });
    }

    /**
     * Analyze peak usage hours
     */
    private Mono<Map<String, Object>> getPeakUsageHours(UUID userId, LocalDateTime start, LocalDateTime end) {
        return usageSessionRepository.findSessionsByDateRange(userId, start, end)
            .collectList()
            .map(sessions -> {
                if (sessions.isEmpty()) {
                    return Map.of("peakHours", "no_data");
                }

                // Group sessions by hour of day
                Map<Integer, Long> hourlyUsage = sessions.stream()
                    .collect(java.util.stream.Collectors.groupingBy(
                        session -> session.getStartedAt().atZone(java.time.ZoneId.systemDefault()).getHour(),
                        java.util.stream.Collectors.counting()
                    ));

                // Find peak hours
                int peakHour = hourlyUsage.entrySet().stream()
                    .max(Map.Entry.comparingByValue())
                    .map(Map.Entry::getKey)
                    .orElse(-1);

                long peakSessionCount = hourlyUsage.getOrDefault(peakHour, 0L);

                return Map.of(
                    "peakHour", peakHour,
                    "peakSessionCount", peakSessionCount,
                    "hourlyBreakdown", hourlyUsage,
                    "analysisNote", "Peak hour analysis based on session start times"
                );
            });
    }

    /**
     * Determine usage pattern based on session data
     */
    private String determineUsagePattern(int sessionCount, double avgDuration, LocalDateTime start, LocalDateTime end) {
        long days = ChronoUnit.DAYS.between(start.toLocalDate(), end.toLocalDate());
        double sessionsPerDay = sessionCount / (double) days;

        if (sessionCount == 0) return "no_usage";
        if (sessionsPerDay < 0.5) return "minimal_usage";
        if (sessionsPerDay < 2 && avgDuration > 120) return "long_infrequent";
        if (sessionsPerDay > 3 && avgDuration < 30) return "frequent_short";
        if (sessionsPerDay >= 1 && sessionsPerDay <= 3 && avgDuration >= 30 && avgDuration <= 120) return "regular_moderate";
        if (sessionsPerDay > 3 && avgDuration > 60) return "heavy_usage";

        return "variable";
    }

    /**
     * Generate household comparison report
     */
    public Mono<Map<String, Object>> generateHouseholdComparison(UUID householdId, int days) {
        log.debug("Generating household comparison for household {} over {} days", householdId, days);

        LocalDateTime cutoff = LocalDateTime.now().minusDays(days);

        return usageSessionRepository.findSessionsByHousehold(householdId)
            .filter(session -> session.getStartedAt().isAfter(cutoff.toInstant(java.time.ZoneOffset.UTC)))
            .collectList()
            .map(sessions -> {
                if (sessions.isEmpty()) {
                    return Map.of(
                        "householdId", householdId.toString(),
                        "message", "No usage data found for household",
                        "days", days
                    );
                }

                // Group by user for comparison
                Map<UUID, List<UsageSession>> userSessions = sessions.stream()
                    .collect(java.util.stream.Collectors.groupingBy(UsageSession::getUserId));

                Map<String, Object> userComparison = userSessions.entrySet().stream()
                    .collect(java.util.stream.Collectors.toMap(
                        entry -> entry.getKey().toString(),
                        entry -> {
                            List<UsageSession> userSessionList = entry.getValue();
                            double totalMinutes = userSessionList.stream()
                                .filter(session -> session.getDurationMinutes() != null)
                                .mapToInt(UsageSession::getDurationMinutes)
                                .sum();

                            return Map.of(
                                "sessionCount", userSessionList.size(),
                                "totalMinutes", totalMinutes,
                                "averageSessionMinutes", userSessionList.size() > 0 ? totalMinutes / userSessionList.size() : 0,
                                "uniqueRooms", userSessionList.stream()
                                    .map(UsageSession::getRoomId)
                                    .distinct()
                                    .count()
                            );
                        }
                    ));

                return Map.of(
                    "householdId", householdId.toString(),
                    "analysisperiod", days,
                    "totalUsers", userSessions.size(),
                    "totalSessions", sessions.size(),
                    "userComparison", userComparison,
                    "generatedAt", LocalDateTime.now().toString()
                );
            })
            .doOnSuccess(report -> log.info("Generated household comparison for {}: {} users analyzed", householdId, days))
            .onErrorResume(error -> {
                log.error("Error generating household comparison for {}", householdId, error);
                return Mono.just(Map.<String, Object>of("error", "Failed to generate household comparison"));
            })
            .map(result -> (Map<String, Object>) result);
    }
}