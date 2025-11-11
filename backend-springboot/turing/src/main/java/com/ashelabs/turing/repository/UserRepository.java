package com.ashelabs.turing.repository;

import com.ashelabs.turing.entity.User;
import com.ashelabs.turing.entity.UserRole;
import com.ashelabs.turing.entity.UserStatus;
import org.springframework.data.r2dbc.repository.Modifying;
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Reactive repository for managing user entities
 * Provides CRUD operations and custom queries for user management,
 * authentication, and household operations
 * 
 * Key Features:
 * - User authentication and authorization
 * - Household-based user filtering and management
 * - Role-based access control queries
 * - User status and activity tracking
 * - Enterprise features (employee ID, department, cost center)
 * 
 * @author AsheLabsAPI
 * @since 1.0.0
 */
@Repository
public interface UserRepository extends ReactiveCrudRepository<User, UUID> {

    /**
     * Finds a user by their email address
     * Used for authentication and user lookup
     * 
     * @param email the user's email address
     * @return Mono containing the user if found, empty otherwise
     */
    @Query("SELECT u.* FROM users u WHERE u.email = :email")
    Mono<User> findByEmail(@Param("email") String email);

    /**
     * Finds all users belonging to a specific household
     * Core method for household-based user management
     * 
     * @param householdId the household identifier
     * @return Flux of users in the household
     */
    @Query("""
            SELECT u.* FROM users u
            WHERE u.household_id = :householdId
            ORDER BY u.created_at ASC
            """)
    Flux<User> findByHouseholdId(@Param("householdId") UUID householdId);

    /**
     * Finds active users in a household (status = ACTIVE)
     * Used for quota assignment and active user management
     * 
     * @param householdId the household identifier
     * @return Flux of active users in the household
     */
    @Query("""
            SELECT u.* FROM users u
            WHERE u.household_id = :householdId AND u.status = 'ACTIVE'
            ORDER BY u.created_at ASC
            """)
    Flux<User> findActiveUsersByHousehold(@Param("householdId") UUID householdId);

    /**
     * Finds users by their role
     * Used for role-based filtering and management
     * 
     * @param role the user role to filter by
     * @return Flux of users with the specified role
     */
    @Query("""
            SELECT u.* FROM users u
            WHERE u.role = :role
            ORDER BY u.created_at ASC
            """)
    Flux<User> findByRole(@Param("role") UserRole role);

    /**
     * Finds users by role within a specific household
     * Used for household-specific role management (e.g., finding all parents in a
     * household)
     * 
     * @param householdId the household identifier
     * @param role        the user role to filter by
     * @return Flux of users with the specified role in the household
     */
    @Query("""
            SELECT u.* FROM users u
            WHERE u.household_id = :householdId AND u.role = :role
            ORDER BY u.created_at ASC
            """)
    Flux<User> findByHouseholdAndRole(
            @Param("householdId") UUID householdId,
            @Param("role") UserRole role);

    /**
     * Finds users by their status
     * Used for user status management and filtering
     * 
     * @param status the user status to filter by
     * @return Flux of users with the specified status
     */
    @Query("""
            SELECT u.* FROM users u
            WHERE u.status = :status
            ORDER BY u.created_at ASC
            """)
    Flux<User> findByStatus(@Param("status") UserStatus status);

    /**
     * Counts users in a household by role
     * Used for household composition analysis
     * 
     * @param householdId the household identifier
     * @param role        the role to count
     * @return Mono containing the count of users with the specified role
     */
    @Query("""
            SELECT COUNT(*) FROM users u
            WHERE u.household_id = :householdId AND u.role = :role
            """)
    Mono<Long> countByHouseholdAndRole(
            @Param("householdId") UUID householdId,
            @Param("role") UserRole role);

    /**
     * Counts active users in a household
     * Used for household activity metrics
     * 
     * @param householdId the household identifier
     * @return Mono containing the count of active users
     */
    @Query("""
            SELECT COUNT(*) FROM users u
            WHERE u.household_id = :householdId AND u.status = 'ACTIVE'
            """)
    Mono<Long> countActiveUsersByHousehold(@Param("householdId") UUID householdId);

    /**
     * Finds users who are children (role = CHILD) and under a certain age
     * Used for age-based quota management and parental controls
     * 
     * @param householdId   the household identifier
     * @param maxAge        maximum age in years
     * @param referenceDate date to calculate age from (usually current date)
     * @return Flux of child users under the specified age
     */
    @Query("""
            SELECT u.* FROM users u
            WHERE u.household_id = :householdId
            AND u.role = 'CHILD'
            AND u.date_of_birth IS NOT NULL
            AND EXTRACT(YEAR FROM AGE(:referenceDate, u.date_of_birth)) < :maxAge
            ORDER BY u.date_of_birth DESC
            """)
    Flux<User> findChildrenUnderAge(
            @Param("householdId") UUID householdId,
            @Param("maxAge") Integer maxAge,
            @Param("referenceDate") LocalDate referenceDate);

    /**
     * Finds administrators and parents in a household
     * Used for permission checks and notification targeting
     * 
     * @param householdId the household identifier
     * @return Flux of users with admin or parent roles
     */
    @Query("""
            SELECT u.* FROM users u
            WHERE u.household_id = :householdId
            AND (u.role = 'PARENT' OR u.role = 'ADMIN')
            AND u.status = 'ACTIVE'
            ORDER BY u.role ASC, u.created_at ASC
            """)
    Flux<User> findHouseholdAdministrators(@Param("householdId") UUID householdId);

    /**
     * Updates the last login timestamp for a user
     * Used for authentication tracking and activity monitoring
     * 
     * @param userId    the user identifier
     * @param loginTime the login timestamp
     * @return Mono containing the number of rows updated
     */
    @Modifying
    @Query("UPDATE users SET last_login_at = :loginTime WHERE id = :userId")
    Mono<Integer> updateLastLogin(
            @Param("userId") UUID userId,
            @Param("loginTime") Instant loginTime);

    /**
     * Finds users by employee ID (enterprise feature)
     * Used for enterprise user management
     * 
     * @param employeeId the employee identifier
     * @return Mono containing the user if found
     */
    @Query("SELECT u.* FROM users u WHERE u.employee_id = :employeeId")
    Mono<User> findByEmployeeId(@Param("employeeId") String employeeId);

    /**
     * Finds users by department (enterprise feature)
     * Used for department-based user filtering
     * 
     * @param department the department name
     * @return Flux of users in the specified department
     */
    @Query("""
            SELECT u.* FROM users u
            WHERE u.department = :department
            ORDER BY u.created_at ASC
            """)
    Flux<User> findByDepartment(@Param("department") String department);

    /**
     * Finds users by cost center (enterprise feature)
     * Used for cost center-based reporting and management
     * 
     * @param costCenter the cost center identifier
     * @return Flux of users assigned to the cost center
     */
    @Query("""
            SELECT u.* FROM users u
            WHERE u.cost_center = :costCenter
            ORDER BY u.created_at ASC
            """)
    Flux<User> findByCostCenter(@Param("costCenter") String costCenter);

    /**
     * Checks if an email address is already in use
     * Used for user registration validation
     * 
     * @param email the email to check
     * @return Mono<Boolean> true if email exists, false otherwise
     */
    @Query("SELECT COUNT(*) > 0 FROM users WHERE email = :email")
    Mono<Boolean> existsByEmail(@Param("email") String email);

    /**
     * Checks if an employee ID is already in use (enterprise feature)
     * 
     * @param employeeId the employee ID to check
     * @return Mono<Boolean> true if employee ID exists, false otherwise
     */
    @Query("SELECT COUNT(*) > 0 FROM users WHERE employee_id = :employeeId")
    Mono<Boolean> existsByEmployeeId(@Param("employeeId") String employeeId);

    /**
     * Deactivates users by setting their status to INACTIVE
     * Used for bulk user management operations
     * 
     * @param userIds array of user IDs to deactivate
     * @return Mono containing the number of users deactivated
     */
    @Modifying
    @Query("UPDATE users SET status = 'INACTIVE' WHERE id = ANY(:userIds)")
    Mono<Integer> deactivateUsers(@Param("userIds") UUID[] userIds);

    /**
     * Finds users who haven't logged in within a specified period
     * Used for inactive user cleanup and security monitoring
     * 
     * @param cutoffDate users who haven't logged in since this date
     * @return Flux of users who haven't logged in recently
     */
    @Query("""
            SELECT u.* FROM users u
            WHERE u.last_login_at < :cutoffDate
            OR u.last_login_at IS NULL
            ORDER BY u.last_login_at ASC NULLS FIRST
            """)
    Flux<User> findUsersNotLoggedInSince(@Param("cutoffDate") Instant cutoffDate);

    /**
     * Updates user preferences
     * Used for user settings management
     * 
     * @param userId      the user identifier
     * @param preferences the new preferences JSON
     * @return Mono containing the number of rows updated
     */
    @Modifying
    @Query("UPDATE users SET preferences = CAST(:preferences AS jsonb) WHERE id = :userId")
    Mono<Integer> updatePreferences(
            @Param("userId") UUID userId,
            @Param("preferences") String preferences);

    /**
     * Finds users whose accounts are about to expire or require attention
     * Used for proactive user account management
     * 
     * @param warningDays   number of days before considering an account as needing
     *                      attention
     * @param referenceDate reference date for calculation
     * @return Flux of users requiring attention
     */
    @Query("""
            SELECT u.* FROM users u
            WHERE u.status = 'ACTIVE'
            AND (
                u.last_login_at < :referenceDate - INTERVAL ':warningDays days'
                OR u.last_login_at IS NULL
            )
            ORDER BY u.last_login_at ASC NULLS FIRST
            """)
    Flux<User> findUsersRequiringAttention(
            @Param("warningDays") Integer warningDays,
            @Param("referenceDate") Instant referenceDate);

    /**
     * Gets user statistics for a household
     * Returns aggregated data about user composition and activity
     * 
     * @param householdId the household identifier
     * @return Mono containing user statistics as a structured result
     */
    @Query("""
            SELECT
                COUNT(*) as total_users,
                COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_users,
                COUNT(CASE WHEN role = 'PARENT' THEN 1 END) as parents,
                COUNT(CASE WHEN role = 'CHILD' THEN 1 END) as children,
                COUNT(CASE WHEN role = 'ADMIN' THEN 1 END) as admins,
                COUNT(CASE WHEN last_login_at > NOW() - INTERVAL '7 days' THEN 1 END) as recently_active
            FROM users
            WHERE household_id = :householdId
            """)
    Mono<Object> getHouseholdUserStatistics(@Param("householdId") UUID householdId);

    /**
     * Count total users in a household
     * Used for family statistics
     * 
     * @param householdId the household identifier
     * @return Mono containing the count of users in the household
     */
    @Query("SELECT COUNT(*) FROM users WHERE household_id = :householdId")
    Mono<Long> countByHouseholdId(@Param("householdId") UUID householdId);
}