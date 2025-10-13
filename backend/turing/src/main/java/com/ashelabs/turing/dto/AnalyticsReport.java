package com.ashelabs.turing.dto;

import lombok.Builder;
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Data Transfer Objects for Analytics and Reporting API responses.
 */
public class AnalyticsReport {

    @Data
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class UsageStatistics {
        private String userId;
        private String roomId;
        private Period period;
        private Statistics statistics;
        private Long todayUsageSeconds;
        private List<SessionSummary> sessions;
        private LocalDateTime generatedAt;

        @Data
        @Builder
        public static class Period {
            private String start;
            private String end;
        }

        @Data
        @Builder
        public static class Statistics {
            private Integer sessionCount;
            private Long totalSeconds;
            private Double avgDurationSeconds;
            private Integer roomsUsed;
        }
    }

    @Data
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class UsageTrends {
        private String userId;
        private Long todayUsageSeconds;
        private Long weeklyUsageSeconds;
        private Long monthlyUsageSeconds;
        private Double averageDailyUsage;
        private LocalDateTime generatedAt;
    }

    @Data
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class HouseholdUsage {
        private String householdId;
        private Integer periodDays;
        private Long totalUsageSeconds;
        private Integer totalSessions;
        private Map<String, Long> userUsage;  // userId -> usage in seconds
        private Map<String, Long> roomUsage;  // roomId -> usage in seconds
        private LocalDateTime generatedAt;
    }

    @Data
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class QuotaUtilization {
        private String userId;
        private String period;
        private List<QuotaDetails> quotas;
        private Integer totalQuotas;
        private LocalDateTime generatedAt;

        @Data
        @Builder
        public static class QuotaDetails {
            private String quotaId;
            private String roomId;
            private String quotaType;
            private Double allowedSeconds;
            private Double usedSeconds;
            private Double utilizationPercent;
            private String status;
            private Boolean isExceeded;
        }
    }

    @Data
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class UserInsights {
        private String userId;
        private Integer analysisPeriod;
        private UsagePatterns usagePatterns;
        private QuotaCompliance quotaCompliance;
        private UsageEfficiency usageEfficiency;
        private PeakUsageHours peakUsageHours;
        private LocalDateTime generatedAt;

        @Data
        @Builder
        public static class UsagePatterns {
            private Integer totalSessions;
            private Double averageSessionMinutes;
            private Integer longestSessionMinutes;
            private Integer shortestSessionMinutes;
            private String pattern;
            private Double sessionsPerDay;
        }

        @Data
        @Builder
        public static class QuotaCompliance {
            private Boolean hasQuotas;
            private Integer totalQuotas;
            private Long compliantQuotas;
            private Double complianceRate;
            private List<QuotaComplianceDetail> quotaDetails;
        }

        @Data
        @Builder
        public static class QuotaComplianceDetail {
            private String quotaId;
            private String roomId;
            private Double allowedSeconds;
            private Double usedSeconds;
            private Double usagePercent;
            private Boolean isCompliant;
            private String status;
        }

        @Data
        @Builder
        public static class UsageEfficiency {
            private Map<String, RoomEfficiency> roomBreakdown;
            private Integer totalRoomsUsed;
            private Double averageSessionsPerRoom;
        }

        @Data
        @Builder
        public static class RoomEfficiency {
            private Integer sessionCount;
            private Double averageSessionMinutes;
            private Integer totalUsageMinutes;
        }

        @Data
        @Builder
        public static class PeakUsageHours {
            private Integer peakHour;
            private Long peakSessionCount;
            private Map<Integer, Long> hourlyBreakdown;
            private String analysisNote;
        }
    }

    @Data
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class HouseholdComparison {
        private String householdId;
        private Integer analysisPeriod;
        private Integer totalUsers;
        private Integer totalSessions;
        private Map<String, UserComparisonData> userComparison;
        private LocalDateTime generatedAt;

        @Data
        @Builder
        public static class UserComparisonData {
            private Integer sessionCount;
            private Double totalMinutes;
            private Double averageSessionMinutes;
            private Long uniqueRooms;
        }
    }

    @Data
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SystemOverview {
        private Long activeSessionsCount;
        private Long totalQuotasCount;
        private String systemStatus;
        private LocalDateTime generatedAt;
        private String generatedBy;
    }

    @Data
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SessionSummary {
        private String sessionId;
        private String roomId;
        private LocalDateTime startTime;
        private LocalDateTime endTime;
        private Integer durationMinutes;
        private String status;
    }

    @Data
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ErrorResponse {
        private String error;
        private String message;
        private String code;
        private LocalDateTime timestamp;
    }
}