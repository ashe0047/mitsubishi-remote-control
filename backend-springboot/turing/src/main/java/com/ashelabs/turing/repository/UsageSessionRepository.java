package com.ashelabs.turing.repository;

import com.ashelabs.turing.entity.SessionStatus;
import com.ashelabs.turing.entity.UsageSession;
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
 * Reactive repository for managing usage session entities
 * Provides CRUD operations and custom queries for session management and usage
 * tracking
 * 
 * Key Features:
 * - Active session detection and management
 * - Daily, weekly, and monthly usage calculations
 * - Session duration tracking and analysis
 * - User activity patterns and statistics
 * 
 * @author AsheLabsAPI
 * @since 1.0.0
 */
@Repository
public interface UsageSessionRepository extends ReactiveCrudRepository<UsageSession, UUID> {

    /**
     * Finds the currently active session for a user in a specific room
     * An active session is one without an end_time
     * 
     * @param userId the user's unique identifier
     * @param roomId the room identifier
     * @return Mono containing the active session if found, empty otherwise
     */
    @Query("""
            SELECT us.* FROM usage_sessions us
            WHERE us.user_id = :userId AND us.room_id = :roomId
            AND us.end_time IS NULL
            ORDER BY us.start_time DESC
            LIMIT 1
            """)
    Mono<UsageSession> findActiveSession(
            @Param("userId") UUID userId,
            @Param("roomId") String roomId);

    /**
     * Finds all active sessions for a specific user across all rooms
     * 
     * @param userId the user's unique identifier
     * @return Flux of active sessions for the user
     */
    @Query("""
            SELECT us.* FROM usage_sessions us
            WHERE us.user_id = :userId AND us.end_time IS NULL
            ORDER BY us.start_time DESC
            """)
    Flux<UsageSession> findActiveSessionsByUser(@Param("userId") UUID userId);

    /**
     * Calculates total daily usage in seconds for a specific user
     * Used for quota validation and daily usage tracking
     * 
     * @param userId the user's unique identifier
     * @param date   the specific date to calculate usage for
     * @return Mono containing the total usage in seconds, 0 if no usage found
     */
    @Query("""
            SELECT COALESCE(SUM(
                CASE
                    WHEN us.end_time IS NULL THEN
                        EXTRACT(EPOCH FROM (NOW() - us.start_time))::INTEGER
                    ELSE us.duration_seconds
                END
            ), 0)::BIGINT
            FROM usage_sessions us
            WHERE us.user_id = :userId
            AND DATE(us.start_time) = :date
            """)
    Mono<Long> calculateDailyUsage(
            @Param("userId") UUID userId,
            @Param("date") LocalDate date);

    /**
     * Calculates daily usage for a user in a specific room
     * 
     * @param userId the user's unique identifier
     * @param roomId the room identifier
     * @param date   the specific date to calculate usage for
     * @return Mono containing the room-specific usage in seconds
     */
    @Query("""
            SELECT COALESCE(SUM(
                CASE
                    WHEN us.end_time IS NULL THEN
                        EXTRACT(EPOCH FROM (NOW() - us.start_time))::INTEGER
                    ELSE us.duration_seconds
                END
            ), 0)::BIGINT
            FROM usage_sessions us
            WHERE us.user_id = :userId AND us.room_id = :roomId
            AND DATE(us.start_time) = :date
            """)
    Mono<Long> calculateDailyUsageByRoom(
            @Param("userId") UUID userId,
            @Param("roomId") String roomId,
            @Param("date") LocalDate date);

    /**
     * Finds usage sessions for a user within a specific date range
     * Used for usage history and reporting
     * 
     * @param userId    the user's unique identifier
     * @param startDate start of the date range (inclusive)
     * @param endDate   end of the date range (exclusive)
     * @return Flux of sessions within the date range
     */
    @Query("""
            SELECT us.* FROM usage_sessions us
            WHERE us.user_id = :userId
            AND us.start_time >= :startDate AND us.start_time < :endDate
            ORDER BY us.start_time DESC
            """)
    Flux<UsageSession> findSessionsByDateRange(
            @Param("userId") UUID userId,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate);

    /**
     * Finds sessions for a specific room within a date range
     * Used for room usage analysis
     * 
     * @param roomId    the room identifier
     * @param startDate start of the date range (inclusive)
     * @param endDate   end of the date range (exclusive)
     * @return Flux of sessions in the room within the date range
     */
    @Query("""
            SELECT us.* FROM usage_sessions us
            WHERE us.room_id = :roomId
            AND us.start_time >= :startDate AND us.start_time < :endDate
            ORDER BY us.start_time DESC
            """)
    Flux<UsageSession> findSessionsByRoomAndDateRange(
            @Param("roomId") String roomId,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate);

    /**
     * Finds all sessions for users within a household
     * Used for household usage reporting and analysis
     * 
     * @param householdId the household identifier
     * @return Flux of sessions for all users in the household
     */
    @Query("""
            SELECT us.* FROM usage_sessions us
            INNER JOIN users u ON us.user_id = u.id
            WHERE u.household_id = :householdId
            ORDER BY us.start_time DESC
            """)
    Flux<UsageSession> findSessionsByHousehold(@Param("householdId") UUID householdId);

    /**
     * Calculates weekly usage for a user
     * 
     * @param userId    the user's unique identifier
     * @param weekStart the start of the week (Monday)
     * @return Mono containing the total weekly usage in seconds
     */
    @Query("""
            SELECT COALESCE(SUM(
                CASE
                    WHEN us.end_time IS NULL THEN
                        EXTRACT(EPOCH FROM (NOW() - us.start_time))::INTEGER
                    ELSE us.duration_seconds
                END
            ), 0)::BIGINT
            FROM usage_sessions us
            WHERE us.user_id = :userId
            AND us.start_time >= :weekStart
            AND us.start_time < :weekStart + INTERVAL '7 days'
            """)
    Mono<Long> calculateWeeklyUsage(
            @Param("userId") UUID userId,
            @Param("weekStart") LocalDateTime weekStart);

    /**
     * Calculates monthly usage for a user
     * 
     * @param userId     the user's unique identifier
     * @param monthStart the first day of the month
     * @return Mono containing the total monthly usage in seconds
     */
    @Query("""
            SELECT COALESCE(SUM(
                CASE
                    WHEN us.end_time IS NULL THEN
                        EXTRACT(EPOCH FROM (NOW() - us.start_time))::INTEGER
                    ELSE us.duration_seconds
                END
            ), 0)::BIGINT
            FROM usage_sessions us
            WHERE us.user_id = :userId
            AND DATE_TRUNC('month', us.start_time) = DATE_TRUNC('month', :monthStart)
            """)
    Mono<Long> calculateMonthlyUsage(
            @Param("userId") UUID userId,
            @Param("monthStart") LocalDateTime monthStart);

    /**
     * Finds the longest session for a user within a date range
     * Used for usage pattern analysis
     * 
     * @param userId    the user's unique identifier
     * @param startDate start of the date range
     * @param endDate   end of the date range
     * @return Mono containing the session with maximum duration
     */
    @Query("""
            SELECT us.* FROM usage_sessions us
            WHERE us.user_id = :userId
            AND us.start_time >= :startDate AND us.start_time < :endDate
            AND us.end_time IS NOT NULL
            ORDER BY us.duration_seconds DESC
            LIMIT 1
            """)
    Mono<UsageSession> findLongestSession(
            @Param("userId") UUID userId,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate);

    /**
     * Ends all active sessions for a user
     * Used for emergency session cleanup or user logout
     * 
     * @param userId  the user's unique identifier
     * @param endTime the time to mark as session end
     * @return Mono containing the number of sessions ended
     */
    @Modifying
    @Query("""
            UPDATE usage_sessions
            SET end_time = :endTime,
                duration_seconds = EXTRACT(EPOCH FROM (:endTime - start_time))::INTEGER,
                status = 'COMPLETED'
            WHERE user_id = :userId AND end_time IS NULL
            """)
    Mono<Integer> endAllActiveSessionsForUser(
            @Param("userId") UUID userId,
            @Param("endTime") Instant endTime);

    /**
     * Finds sessions by status
     * 
     * @param status the session status to filter by
     * @return Flux of sessions with the specified status
     */
    @Query("""
            SELECT us.* FROM usage_sessions us
            WHERE us.status = :status
            ORDER BY us.start_time DESC
            """)
    Flux<UsageSession> findSessionsByStatus(@Param("status") SessionStatus status);

    /**
     * Counts active sessions across all users and rooms
     * Used for system monitoring and capacity planning
     * 
     * @return Mono containing the count of active sessions
     */
    @Query("SELECT COUNT(*) FROM usage_sessions WHERE end_time IS NULL")
    Mono<Long> countActiveSessions();

    /**
     * Finds sessions that have been running longer than a specified duration
     * Used for detecting stuck sessions or unusual usage patterns
     * 
     * @param maxDurationMinutes maximum duration in minutes before considering a
     *                           session long-running
     * @return Flux of long-running sessions
     */
    @Query("""
            SELECT us.* FROM usage_sessions us
            WHERE us.end_time IS NULL
            AND us.start_time < NOW() - INTERVAL ':maxDurationMinutes minutes'
            ORDER BY us.start_time ASC
            """)
    Flux<UsageSession> findLongRunningSessions(@Param("maxDurationMinutes") Integer maxDurationMinutes);

    /**
     * Gets usage statistics for a user over a specific period
     * Returns aggregated data including total sessions, total time, and average
     * session duration
     * 
     * @param userId    the user's unique identifier
     * @param startDate start of the period
     * @param endDate   end of the period
     * @return Mono containing usage statistics as a JSON-like structure
     */
    @Query("""
            SELECT
                COUNT(*) as session_count,
                COALESCE(SUM(duration_seconds), 0) as total_seconds,
                COALESCE(AVG(duration_seconds), 0) as avg_duration_seconds,
                COUNT(DISTINCT room_id) as rooms_used
            FROM usage_sessions
            WHERE user_id = :userId
            AND start_time >= :startDate AND start_time < :endDate
            AND end_time IS NOT NULL
            """)
    Mono<Object> getUsageStatistics(
            @Param("userId") UUID userId,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate);

    /**
     * Deletes old completed sessions to maintain database performance
     * Used by cleanup scheduled tasks
     * 
     * @param cutoffDate sessions older than this date will be deleted
     * @return Mono containing the number of sessions deleted
     */
    @Modifying
    @Query("""
            DELETE FROM usage_sessions
            WHERE end_time IS NOT NULL
            AND end_time < :cutoffDate
            """)
    Mono<Integer> deleteOldSessions(@Param("cutoffDate") Instant cutoffDate);
}