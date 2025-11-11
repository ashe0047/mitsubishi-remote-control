package com.ashelabs.turing.repository;

import com.ashelabs.turing.entity.Household;
import org.springframework.data.r2dbc.repository.Modifying;
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.UUID;

/**
 * Reactive repository for managing household entities
 * Provides CRUD operations and custom queries for household management and
 * multi-tenancy support
 * 
 * Key Features:
 * - Household-based multi-tenancy
 * - Member management and household composition
 * - Household settings and preferences management
 * - Enterprise features (organization, billing)
 * - Subscription and plan management
 * 
 * @author AsheLabsAPI
 * @since 1.0.0
 */
@Repository
public interface HouseholdRepository extends ReactiveCrudRepository<Household, UUID> {

    /**
     * Finds a household by its unique name
     * Used for household identification and name validation
     * 
     * @param name the household name
     * @return Mono containing the household if found, empty otherwise
     */
    @Query("SELECT h.* FROM households h WHERE h.name = :name")
    Mono<Household> findByName(@Param("name") String name);

    /**
     * Finds households by organization (enterprise feature)
     * Used for organization-wide household management
     * 
     * @param organizationId the organization identifier
     * @return Flux of households in the organization
     */
    @Query("""
            SELECT h.* FROM households h
            WHERE h.organization_id = :organizationId
            ORDER BY h.created_at ASC
            """)
    Flux<Household> findByOrganizationId(@Param("organizationId") UUID organizationId);

    /**
     * Finds households by subscription plan
     * Used for subscription management and billing operations
     * 
     * @param subscriptionPlan the subscription plan name
     * @return Flux of households with the specified plan
     */
    @Query("""
            SELECT h.* FROM households h
            WHERE h.subscription_plan = :subscriptionPlan
            ORDER BY h.created_at ASC
            """)
    Flux<Household> findBySubscriptionPlan(@Param("subscriptionPlan") String subscriptionPlan);

    /**
     * Finds active households (is_active = true)
     * Used for filtering out deactivated or suspended households
     * 
     * @return Flux of active households
     */
    @Query("""
            SELECT h.* FROM households h
            WHERE h.is_active = true
            ORDER BY h.created_at ASC
            """)
    Flux<Household> findActiveHouseholds();

    /**
     * Finds households with subscriptions expiring within a specified number of
     * days
     * Used for subscription renewal notifications and billing operations
     * 
     * @param daysFromNow number of days from current date to check
     * @return Flux of households with expiring subscriptions
     */
    @Query("""
            SELECT h.* FROM households h
            WHERE h.subscription_end_date IS NOT NULL
            AND h.subscription_end_date <= CURRENT_DATE + INTERVAL ':daysFromNow days'
            AND h.subscription_end_date >= CURRENT_DATE
            ORDER BY h.subscription_end_date ASC
            """)
    Flux<Household> findHouseholdsWithExpiringSubscriptions(@Param("daysFromNow") Integer daysFromNow);

    /**
     * Finds households that have exceeded their user limits
     * Used for subscription compliance and billing enforcement
     * 
     * @return Flux of households exceeding their user limits
     */
    @Query("""
            SELECT h.* FROM households h
            WHERE (
                SELECT COUNT(*) FROM users u
                WHERE u.household_id = h.id AND u.status = 'ACTIVE'
            ) > h.max_users
            ORDER BY h.created_at ASC
            """)
    Flux<Household> findHouseholdsExceedingUserLimit();

    /**
     * Finds households by their timezone
     * Used for time-based operations and scheduling
     * 
     * @param timezone the timezone identifier (e.g., "America/New_York")
     * @return Flux of households in the specified timezone
     */
    @Query("""
            SELECT h.* FROM households h
            WHERE h.timezone = :timezone
            ORDER BY h.created_at ASC
            """)
    Flux<Household> findByTimezone(@Param("timezone") String timezone);

    /**
     * Checks if a household name is already in use
     * Used for household registration validation
     * 
     * @param name the name to check
     * @return Mono<Boolean> true if name exists, false otherwise
     */
    @Query("SELECT COUNT(*) > 0 FROM households WHERE name = :name")
    Mono<Boolean> existsByName(@Param("name") String name);

    /**
     * Updates household settings/preferences
     * Used for household configuration management
     * 
     * @param householdId the household identifier
     * @param settings    the new settings JSON
     * @return Mono containing the number of rows updated
     */
    @Modifying
    @Query("UPDATE households SET settings = CAST(:settings AS jsonb) WHERE id = :householdId")
    Mono<Integer> updateSettings(
            @Param("householdId") UUID householdId,
            @Param("settings") String settings);

    /**
     * Updates household subscription information
     * Used for subscription management and billing operations
     * 
     * @param householdId         the household identifier
     * @param subscriptionPlan    the new subscription plan
     * @param subscriptionEndDate the subscription end date
     * @return Mono containing the number of rows updated
     */
    @Modifying
    @Query("""
            UPDATE households
            SET subscription_plan = :subscriptionPlan,
                subscription_end_date = :subscriptionEndDate
            WHERE id = :householdId
            """)
    Mono<Integer> updateSubscription(
            @Param("householdId") UUID householdId,
            @Param("subscriptionPlan") String subscriptionPlan,
            @Param("subscriptionEndDate") Instant subscriptionEndDate);

    /**
     * Deactivates households by setting is_active to false
     * Used for household suspension or deletion
     * 
     * @param householdIds array of household IDs to deactivate
     * @return Mono containing the number of households deactivated
     */
    @Modifying
    @Query("UPDATE households SET is_active = false WHERE id = ANY(:householdIds)")
    Mono<Integer> deactivateHouseholds(@Param("householdIds") UUID[] householdIds);

    /**
     * Updates the maximum user limit for a household
     * Used for subscription plan changes and capacity management
     * 
     * @param householdId the household identifier
     * @param maxUsers    the new maximum user limit
     * @return Mono containing the number of rows updated
     */
    @Modifying
    @Query("UPDATE households SET max_users = :maxUsers WHERE id = :householdId")
    Mono<Integer> updateMaxUsers(
            @Param("householdId") UUID householdId,
            @Param("maxUsers") Integer maxUsers);

    /**
     * Counts households by organization
     * Used for organization statistics and reporting
     * 
     * @param organizationId the organization identifier
     * @return Mono containing the count of households in the organization
     */
    @Query("SELECT COUNT(*) FROM households WHERE organization_id = :organizationId")
    Mono<Long> countByOrganization(@Param("organizationId") UUID organizationId);

    /**
     * Counts active households by organization
     * Used for organization activity metrics
     * 
     * @param organizationId the organization identifier
     * @return Mono containing the count of active households in the organization
     */
    @Query("""
            SELECT COUNT(*) FROM households
            WHERE organization_id = :organizationId AND is_active = true
            """)
    Mono<Long> countActiveByOrganization(@Param("organizationId") UUID organizationId);

    /**
     * Finds households with the most users
     * Used for capacity planning and resource allocation
     * 
     * @param limit maximum number of results to return
     * @return Flux of households ordered by user count (descending)
     */
    @Query("""
            SELECT h.* FROM households h
            ORDER BY (
                SELECT COUNT(*) FROM users u
                WHERE u.household_id = h.id AND u.status = 'ACTIVE'
            ) DESC
            LIMIT :limit
            """)
    Flux<Household> findHouseholdsWithMostUsers(@Param("limit") Integer limit);

    /**
     * Finds households that haven't been active recently
     * Used for inactive household identification and cleanup
     * 
     * @param cutoffDate households with no user activity since this date
     * @return Flux of inactive households
     */
    @Query("""
            SELECT h.* FROM households h
            WHERE NOT EXISTS (
                SELECT 1 FROM users u
                WHERE u.household_id = h.id
                AND u.last_login_at > :cutoffDate
            )
            AND h.is_active = true
            ORDER BY h.created_at ASC
            """)
    Flux<Household> findInactiveHouseholds(@Param("cutoffDate") Instant cutoffDate);

    /**
     * Gets comprehensive statistics for a household
     * Returns aggregated data about users, usage, and activity
     * 
     * @param householdId the household identifier
     * @return Mono containing household statistics as a structured result
     */
    @Query("""
            SELECT
                h.*,
                (SELECT COUNT(*) FROM users u WHERE u.household_id = h.id) as total_users,
                (SELECT COUNT(*) FROM users u WHERE u.household_id = h.id AND u.status = 'ACTIVE') as active_users,
                (SELECT COUNT(*) FROM quotas q INNER JOIN users u ON q.user_id = u.id WHERE u.household_id = h.id AND q.is_active = true) as active_quotas,
                (SELECT MAX(u.last_login_at) FROM users u WHERE u.household_id = h.id) as last_user_activity
            FROM households h
            WHERE h.id = :householdId
            """)
    Mono<Object> getHouseholdStatistics(@Param("householdId") UUID householdId);

    /**
     * Finds households by address or location (partial match)
     * Used for location-based searches and regional management
     * 
     * @param locationQuery partial address or location string
     * @return Flux of households matching the location query
     */
    @Query("""
            SELECT h.* FROM households h
            WHERE h.address ILIKE '%' || :locationQuery || '%'
            OR h.city ILIKE '%' || :locationQuery || '%'
            OR h.state ILIKE '%' || :locationQuery || '%'
            ORDER BY h.created_at ASC
            """)
    Flux<Household> findByLocation(@Param("locationQuery") String locationQuery);

    /**
     * Updates household contact information
     * Used for household profile management
     * 
     * @param householdId the household identifier
     * @param address     the new address
     * @param city        the new city
     * @param state       the new state
     * @param postalCode  the new postal code
     * @param country     the new country
     * @return Mono containing the number of rows updated
     */
    @Modifying
    @Query("""
            UPDATE households
            SET address = :address, city = :city, state = :state,
                postal_code = :postalCode, country = :country
            WHERE id = :householdId
            """)
    Mono<Integer> updateContactInfo(
            @Param("householdId") UUID householdId,
            @Param("address") String address,
            @Param("city") String city,
            @Param("state") String state,
            @Param("postalCode") String postalCode,
            @Param("country") String country);

    /**
     * Finds households requiring attention (e.g., expired subscriptions, exceeded
     * limits)
     * Used for administrative monitoring and proactive management
     * 
     * @return Flux of households that need attention
     */
    @Query("""
            SELECT h.* FROM households h
            WHERE h.is_active = true
            AND (
                h.subscription_end_date < CURRENT_DATE
                OR (
                    SELECT COUNT(*) FROM users u
                    WHERE u.household_id = h.id AND u.status = 'ACTIVE'
                ) > h.max_users
            )
            ORDER BY h.subscription_end_date ASC NULLS LAST
            """)
    Flux<Household> findHouseholdsRequiringAttention();
}