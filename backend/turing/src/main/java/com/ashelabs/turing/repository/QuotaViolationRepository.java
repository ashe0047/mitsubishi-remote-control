package com.ashelabs.turing.repository;

import com.ashelabs.turing.entity.EnforcementAction;
import com.ashelabs.turing.entity.QuotaViolation;
import org.springframework.data.r2dbc.repository.Modifying;
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Reactive repository for managing quota violation entities
 * Provides CRUD operations and custom queries for quota enforcement and
 * violation tracking
 * 
 * Key Features:
 * - Quota violation detection and recording
 * - Enforcement action tracking and history
 * - Violation pattern analysis and reporting
 * - User behavior monitoring and analytics
 * - Administrative violation management
 * 
 * @author AsheLabsAPI
 * @since 1.0.0
 */
@Repository
public interface QuotaViolationRepository extends ReactiveCrudRepository<QuotaViolation, UUID> {

    /**
     * Finds all violations for a specific user
     * Used for user violation history and pattern analysis
     * 
     * @param userId the user's unique identifier
     * @return Flux of violations for the user
     */
    @Query("""
            SELECT qv.* FROM quota_violations qv
            WHERE qv.user_id = :userId
            ORDER BY qv.violation_time DESC
            """)
    Flux<QuotaViolation> findByUserId(@Param("userId") UUID userId);

    /**
     * Finds violations for a specific quota
     * Used for quota-specific violation tracking
     * 
     * @param quotaId the quota identifier
     * @return Flux of violations for the quota
     */
    @Query("""
            SELECT qv.* FROM quota_violations qv
            WHERE qv.quota_id = :quotaId
            ORDER BY qv.violation_time DESC
            """)
    Flux<QuotaViolation> findByQuotaId(@Param("quotaId") UUID quotaId);

    /**
     * Finds violations in a specific room
     * Used for room-based violation analysis
     * 
     * @param roomId the room identifier
     * @return Flux of violations in the room
     */
    @Query("""
            SELECT qv.* FROM quota_violations qv
            WHERE qv.room_id = :roomId
            ORDER BY qv.violation_time DESC
            """)
    Flux<QuotaViolation> findByRoomId(@Param("roomId") String roomId);

    /**
     * Finds violations by enforcement action type
     * Used for analyzing the effectiveness of different enforcement actions
     * 
     * @param action the enforcement action type
     * @return Flux of violations with the specified action
     */
    @Query("""
            SELECT qv.* FROM quota_violations qv
            WHERE qv.enforcement_action = :action
            ORDER BY qv.violation_time DESC
            """)
    Flux<QuotaViolation> findByEnforcementAction(@Param("action") EnforcementAction action);

    /**
     * Finds violations within a specific time range
     * Used for time-based violation analysis and reporting
     * 
     * @param startTime start of the time range
     * @param endTime   end of the time range
     * @return Flux of violations within the time range
     */
    @Query("""
            SELECT qv.* FROM quota_violations qv
            WHERE qv.violation_time >= :startTime AND qv.violation_time <= :endTime
            ORDER BY qv.violation_time DESC
            """)
    Flux<QuotaViolation> findByTimeRange(
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    /**
     * Finds violations for users within a household
     * Used for household-wide violation monitoring
     * 
     * @param householdId the household identifier
     * @return Flux of violations for all users in the household
     */
    @Query("""
            SELECT qv.* FROM quota_violations qv
            INNER JOIN users u ON qv.user_id = u.id
            WHERE u.household_id = :householdId
            ORDER BY qv.violation_time DESC
            """)
    Flux<QuotaViolation> findByHouseholdId(@Param("householdId") UUID householdId);

    /**
     * Finds recent violations (within the last 24 hours)
     * Used for real-time violation monitoring and alerts
     * 
     * @return Flux of recent violations
     */
    @Query("""
            SELECT qv.* FROM quota_violations qv
            WHERE qv.violation_time >= NOW() - INTERVAL '24 hours'
            ORDER BY qv.violation_time DESC
            """)
    Flux<QuotaViolation> findRecentViolations();

    /**
     * Finds unresolved violations that may require attention
     * Used for administrative follow-up and enforcement
     * 
     * @return Flux of violations that may need resolution
     */
    @Query("""
            SELECT qv.* FROM quota_violations qv
            WHERE qv.enforcement_action IN ('WARNING', 'NOTIFICATION_SENT')
            AND qv.violation_time >= NOW() - INTERVAL '7 days'
            ORDER BY qv.violation_time DESC
            """)
    Flux<QuotaViolation> findUnresolvedViolations();

    /**
     * Counts violations for a specific user within a date range
     * Used for user behavior analysis and repeat offender identification
     * 
     * @param userId    the user's unique identifier
     * @param startDate start of the date range
     * @param endDate   end of the date range
     * @return Mono containing the count of violations
     */
    @Query("""
            SELECT COUNT(*) FROM quota_violations qv
            WHERE qv.user_id = :userId
            AND DATE(qv.violation_time) >= :startDate
            AND DATE(qv.violation_time) <= :endDate
            """)
    Mono<Long> countViolationsByUserAndDateRange(
            @Param("userId") UUID userId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * Counts daily violations for a user
     * Used for daily violation tracking and quota management
     * 
     * @param userId the user's unique identifier
     * @param date   the specific date
     * @return Mono containing the count of violations for the day
     */
    @Query("""
            SELECT COUNT(*) FROM quota_violations qv
            WHERE qv.user_id = :userId AND DATE(qv.violation_time) = :date
            """)
    Mono<Long> countDailyViolationsByUser(
            @Param("userId") UUID userId,
            @Param("date") LocalDate date);

    /**
     * Finds repeat violators (users with multiple violations in a time period)
     * Used for identifying users who consistently exceed quotas
     * 
     * @param minViolations minimum number of violations to be considered a repeat
     *                      violator
     * @param daysPeriod    number of days to look back
     * @return Flux of user IDs who are repeat violators
     */
    @Query("""
            SELECT qv.user_id FROM quota_violations qv
            WHERE qv.violation_time >= NOW() - INTERVAL ':daysPeriod days'
            GROUP BY qv.user_id
            HAVING COUNT(*) >= :minViolations
            ORDER BY COUNT(*) DESC
            """)
    Flux<UUID> findRepeatViolators(
            @Param("minViolations") Integer minViolations,
            @Param("daysPeriod") Integer daysPeriod);

    /**
     * Finds the most violated rooms
     * Used for identifying rooms that frequently have quota violations
     * 
     * @param limit      maximum number of results to return
     * @param daysPeriod number of days to analyze
     * @return Flux of room IDs ordered by violation frequency
     */
    @Query("""
            SELECT qv.room_id FROM quota_violations qv
            WHERE qv.violation_time >= NOW() - INTERVAL ':daysPeriod days'
            GROUP BY qv.room_id
            ORDER BY COUNT(*) DESC
            LIMIT :limit
            """)
    Flux<String> findMostViolatedRooms(
            @Param("limit") Integer limit,
            @Param("daysPeriod") Integer daysPeriod);

    /**
     * Gets violation statistics for a user over a specific period
     * Returns aggregated data about violation patterns and enforcement actions
     * 
     * @param userId    the user's unique identifier
     * @param startDate start of the period
     * @param endDate   end of the period
     * @return Mono containing violation statistics as a structured result
     */
    @Query("""
            SELECT
                COUNT(*) as total_violations,
                COUNT(DISTINCT DATE(qv.violation_time)) as violation_days,
                COUNT(DISTINCT qv.room_id) as rooms_violated,
                COUNT(CASE WHEN qv.enforcement_action = 'WARNING' THEN 1 END) as warnings,
                COUNT(CASE WHEN qv.enforcement_action = 'ACCESS_DENIED' THEN 1 END) as access_denials,
                COUNT(CASE WHEN qv.enforcement_action = 'SYSTEM_SHUTDOWN' THEN 1 END) as shutdowns,
                AVG(qv.exceeded_by_seconds) as avg_exceeded_seconds,
                MAX(qv.exceeded_by_seconds) as max_exceeded_seconds
            FROM quota_violations qv
            WHERE qv.user_id = :userId
            AND DATE(qv.violation_time) >= :startDate
            AND DATE(qv.violation_time) <= :endDate
            """)
    Mono<Object> getViolationStatisticsByUser(
            @Param("userId") UUID userId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * Gets violation statistics for a household
     * 
     * @param householdId the household identifier
     * @param startDate   start of the analysis period
     * @param endDate     end of the analysis period
     * @return Mono containing household violation statistics
     */
    @Query("""
            SELECT
                COUNT(*) as total_violations,
                COUNT(DISTINCT qv.user_id) as users_with_violations,
                COUNT(DISTINCT qv.room_id) as rooms_with_violations,
                COUNT(DISTINCT DATE(qv.violation_time)) as violation_days,
                AVG(qv.exceeded_by_seconds) as avg_exceeded_seconds,
                COUNT(CASE WHEN qv.enforcement_action = 'ACCESS_DENIED' THEN 1 END) as total_access_denials
            FROM quota_violations qv
            INNER JOIN users u ON qv.user_id = u.id
            WHERE u.household_id = :householdId
            AND DATE(qv.violation_time) >= :startDate
            AND DATE(qv.violation_time) <= :endDate
            """)
    Mono<Object> getHouseholdViolationStatistics(
            @Param("householdId") UUID householdId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * Finds violations that resulted in system shutdowns
     * Used for analyzing severe enforcement actions
     * 
     * @param daysPeriod number of days to analyze
     * @return Flux of violations that caused shutdowns
     */
    @Query("""
            SELECT qv.* FROM quota_violations qv
            WHERE qv.enforcement_action = 'SYSTEM_SHUTDOWN'
            AND qv.violation_time >= NOW() - INTERVAL ':daysPeriod days'
            ORDER BY qv.violation_time DESC
            """)
    Flux<QuotaViolation> findShutdownViolations(@Param("daysPeriod") Integer daysPeriod);

    /**
     * Updates the enforcement action for a violation
     * Used for escalating or modifying violation responses
     * 
     * @param violationId the violation identifier
     * @param action      the new enforcement action
     * @return Mono containing the number of rows updated
     */
    @Modifying
    @Query("UPDATE quota_violations SET enforcement_action = :action WHERE id = :violationId")
    Mono<Integer> updateEnforcementAction(
            @Param("violationId") UUID violationId,
            @Param("action") EnforcementAction action);

    /**
     * Deletes old violations to maintain database performance
     * Used by cleanup scheduled tasks
     * 
     * @param cutoffDate violations older than this date will be deleted
     * @return Mono containing the number of violations deleted
     */
    @Modifying
    @Query("DELETE FROM quota_violations WHERE violation_time < :cutoffDate")
    Mono<Integer> deleteOldViolations(@Param("cutoffDate") Instant cutoffDate);

    /**
     * Finds violations where the exceeded time is above a threshold
     * Used for identifying significant quota breaches
     * 
     * @param thresholdSeconds minimum seconds exceeded to be considered significant
     * @return Flux of significant violations
     */
    @Query("""
            SELECT qv.* FROM quota_violations qv
            WHERE qv.exceeded_by_seconds >= :thresholdSeconds
            ORDER BY qv.exceeded_by_seconds DESC, qv.violation_time DESC
            """)
    Flux<QuotaViolation> findSignificantViolations(@Param("thresholdSeconds") Integer thresholdSeconds);

    /**
     * Gets the average violation severity (exceeded time) by room
     * Used for understanding which rooms have the most severe violations
     * 
     * @param daysPeriod number of days to analyze
     * @return Flux of room statistics with average exceeded time
     */
    @Query("""
            SELECT
                qv.room_id,
                COUNT(*) as violation_count,
                AVG(qv.exceeded_by_seconds) as avg_exceeded_seconds,
                MAX(qv.exceeded_by_seconds) as max_exceeded_seconds
            FROM quota_violations qv
            WHERE qv.violation_time >= NOW() - INTERVAL ':daysPeriod days'
            GROUP BY qv.room_id
            ORDER BY AVG(qv.exceeded_by_seconds) DESC
            """)
    Flux<Object> getViolationSeverityByRoom(@Param("daysPeriod") Integer daysPeriod);

    /**
     * Counts total violations across the system
     * Used for system-wide monitoring and metrics
     * 
     * @return Mono containing the total count of violations
     */
    @Query("SELECT COUNT(*) FROM quota_violations")
    Mono<Long> countAllViolations();

    /**
     * Finds the latest violation for each user
     * Used for understanding recent user behavior patterns
     * 
     * @return Flux of the most recent violation for each user
     */
    @Query("""
            SELECT DISTINCT ON (qv.user_id) qv.*
            FROM quota_violations qv
            ORDER BY qv.user_id, qv.violation_time DESC
            """)
    Flux<QuotaViolation> findLatestViolationPerUser();

    /**
     * Checks if a user has had any violations today
     * Used for daily violation status checks
     * 
     * @param userId the user's unique identifier
     * @return Mono<Boolean> true if user has violations today, false otherwise
     */
    @Query("""
            SELECT COUNT(*) > 0 FROM quota_violations qv
            WHERE qv.user_id = :userId
            AND DATE(qv.violation_time) = CURRENT_DATE
            """)
    Mono<Boolean> hasViolationsToday(@Param("userId") UUID userId);

    /**
     * Finds violations that may indicate system abuse or unusual patterns
     * Used for security monitoring and abuse detection
     * 
     * @param maxExceededMinutes threshold for considering a violation as potential
     *                           abuse
     * @param daysPeriod         number of days to analyze
     * @return Flux of potential abuse violations
     */
    @Query("""
            SELECT qv.* FROM quota_violations qv
            WHERE qv.exceeded_by_seconds > (:maxExceededMinutes * 60)
            AND qv.violation_time >= NOW() - INTERVAL ':daysPeriod days'
            ORDER BY qv.exceeded_by_seconds DESC, qv.violation_time DESC
            """)
    Flux<QuotaViolation> findPotentialAbuseViolations(
            @Param("maxExceededMinutes") Integer maxExceededMinutes,
            @Param("daysPeriod") Integer daysPeriod);
}