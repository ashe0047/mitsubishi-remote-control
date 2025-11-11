package com.ashelabs.turing.repository;

import com.ashelabs.turing.entity.Quota;
import org.springframework.data.r2dbc.repository.Modifying;
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Reactive repository for managing quota entities
 * Provides CRUD operations and custom queries for quota validation and
 * management
 * 
 * Performance Requirements:
 * - findActiveQuotaByUserAndRoom must complete in <100ms for quota validation
 * - Uses indexed queries on user_id, room_id, and is_active columns
 * 
 * @author AsheLabsAPI
 * @since 1.0.0
 */
@Repository
public interface QuotaRepository extends ReactiveCrudRepository<Quota, UUID> {

    /**
     * Finds the active quota for a specific user and room combination
     * This is the primary method used for quota validation and must be highly
     * optimized
     * 
     * @param userId      the user's unique identifier
     * @param roomId      the room identifier (e.g., "living-room", "bedroom-1")
     * @param currentDate current date for checking quota validity period
     * @return Mono containing the active quota if found, empty otherwise
     */
    @Query("""
            SELECT q.* FROM quotas q
            WHERE q.user_id = :userId AND q.room_id = :roomId
            AND q.is_active = true AND (q.end_date IS NULL OR q.end_date >= :currentDate)
            ORDER BY q.created_at DESC
            LIMIT 1
            """)
    Mono<Quota> findActiveQuotaByUserAndRoom(
            @Param("userId") UUID userId,
            @Param("roomId") String roomId,
            @Param("currentDate") LocalDate currentDate);

    /**
     * Finds all active quotas for a list of users
     * Used for bulk operations and household quota management
     * 
     * @param userIds list of user identifiers to query
     * @return Flux of active quotas for the specified users
     */
    @Query("SELECT q.* FROM quotas q WHERE q.user_id = ANY(:userIds) AND q.is_active = true")
    Flux<Quota> findActiveQuotasByUsers(@Param("userIds") UUID[] userIds);

    /**
     * Finds all active quotas for users within a specific household
     * Used for household-wide quota management and reporting
     * 
     * @param householdId the household identifier
     * @return Flux of active quotas for all users in the household
     */
    @Query("""
            SELECT q.* FROM quotas q
            INNER JOIN users u ON q.user_id = u.id
            WHERE u.household_id = :householdId AND q.is_active = true
            ORDER BY q.created_at DESC
            """)
    Flux<Quota> findActiveQuotasByHousehold(@Param("householdId") UUID householdId);

    /**
     * Finds all quotas for a specific user, both active and inactive
     * Used for user quota history and management
     * 
     * @param userId the user's unique identifier
     * @return Flux of all quotas for the user
     */
    @Query("""
            SELECT q.* FROM quotas q
            WHERE q.user_id = :userId
            ORDER BY q.created_at DESC
            """)
    Flux<Quota> findQuotasByUser(@Param("userId") UUID userId);

    /**
     * Finds quotas by room identifier across all users
     * Used for room-specific quota analysis and management
     * 
     * @param roomId the room identifier
     * @return Flux of quotas for the specified room
     */
    @Query("""
            SELECT q.* FROM quotas q
            WHERE q.room_id = :roomId AND q.is_active = true
            ORDER BY q.created_at DESC
            """)
    Flux<Quota> findActiveQuotasByRoom(@Param("roomId") String roomId);

    /**
     * Finds quotas that are approaching their limits (>80% usage)
     * Used for proactive notification and enforcement
     * 
     * @return Flux of quotas near their limits
     */
    @Query("""
            SELECT q.* FROM quotas q
            WHERE q.is_active = true
            AND q.daily_used_seconds::FLOAT / q.daily_limit_seconds > 0.8
            AND q.quota_type = 'DAILY_TIME'
            """)
    Flux<Quota> findQuotasNearLimit();

    /**
     * Finds all quotas that have been exceeded
     * Used for enforcement and violation tracking
     * 
     * @return Flux of exceeded quotas
     */
    @Query("""
            SELECT q.* FROM quotas q
            WHERE q.is_active = true
            AND q.daily_used_seconds >= q.daily_limit_seconds
            AND q.quota_type = 'DAILY_TIME'
            """)
    Flux<Quota> findExceededQuotas();

    /**
     * Resets daily usage counters for all daily quotas
     * Called by scheduled task at midnight to reset daily limits
     * 
     * @return Mono containing the number of rows updated
     */
    @Modifying
    @Query("UPDATE quotas SET daily_used_seconds = 0 WHERE quota_type = 'DAILY_TIME'")
    Mono<Integer> resetDailyUsage();

    /**
     * Finds quotas by their status
     * 
     * @param status the quota status to filter by
     * @return Flux of quotas with the specified status
     */
    @Query("""
            SELECT q.* FROM quotas q
            WHERE q.status = :status
            ORDER BY q.created_at DESC
            """)
    Flux<Quota> findQuotasByStatus(@Param("status") String status);

    /**
     * Counts active quotas for a household
     * Used for household quota statistics
     * 
     * @param householdId the household identifier
     * @return Mono containing the count of active quotas
     */
    @Query("""
            SELECT COUNT(q.*) FROM quotas q
            INNER JOIN users u ON q.user_id = u.id
            WHERE u.household_id = :householdId AND q.is_active = true
            """)
    Mono<Long> countActiveQuotasByHousehold(@Param("householdId") UUID householdId);

    /**
     * Updates the daily used seconds for a specific quota
     * Used for batch usage updates and corrections
     * 
     * @param quotaId           the quota identifier
     * @param additionalSeconds seconds to add to current usage
     * @return Mono containing the number of rows updated
     */
    @Modifying
    @Query("""
            UPDATE quotas SET daily_used_seconds = daily_used_seconds + :additionalSeconds
            WHERE id = :quotaId AND is_active = true
            """)
    Mono<Integer> incrementDailyUsage(
            @Param("quotaId") UUID quotaId,
            @Param("additionalSeconds") Integer additionalSeconds);

    /**
     * Deactivates quotas by setting is_active to false
     * Used for bulk quota management operations
     * 
     * @param quotaIds list of quota IDs to deactivate
     * @return Mono containing the number of rows updated
     */
    @Modifying
    @Query("UPDATE quotas SET is_active = false WHERE id = ANY(:quotaIds)")
    Mono<Integer> deactivateQuotas(@Param("quotaIds") UUID[] quotaIds);

    /**
     * Finds quotas that will expire within a specified number of days
     * Used for expiration notifications and cleanup
     * 
     * @param daysFromNow number of days from current date
     * @param currentDate current date
     * @return Flux of quotas expiring soon
     */
    @Query("""
            SELECT q.* FROM quotas q
            WHERE q.is_active = true
            AND q.end_date IS NOT NULL
            AND q.end_date <= :currentDate + INTERVAL ':daysFromNow days'
            AND q.end_date >= :currentDate
            ORDER BY q.end_date ASC
            """)
    Flux<Quota> findQuotasExpiringWithin(
            @Param("daysFromNow") Integer daysFromNow,
            @Param("currentDate") LocalDate currentDate);
}