package com.ashelabs.turing.repository;

import com.ashelabs.turing.entity.AccessLevel;
import com.ashelabs.turing.entity.UserRoomAssignment;
import org.springframework.data.r2dbc.repository.Modifying;
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Reactive repository for managing user room assignment entities
 * Provides CRUD operations and custom queries for room-based access control
 * 
 * Key Features:
 * - Room-based access control and permissions
 * - Time-based access restrictions (time windows)
 * - Household-wide room access management
 * - User permission validation for AC control operations
 * - Access level management (VIEW_ONLY, CONTROL, ADMIN)
 * 
 * @author AsheLabsAPI
 * @since 1.0.0
 */
@Repository
public interface UserRoomAssignmentRepository extends ReactiveCrudRepository<UserRoomAssignment, UUID> {

    /**
     * Finds all room assignments for a specific user
     * Used for determining which rooms a user can access
     * 
     * @param userId the user's unique identifier
     * @return Flux of room assignments for the user
     */
    @Query("""
            SELECT ura.* FROM user_room_assignments ura
            WHERE ura.user_id = :userId AND ura.is_active = true
            ORDER BY ura.created_at ASC
            """)
    Flux<UserRoomAssignment> findByUserId(@Param("userId") UUID userId);

    /**
     * Finds all user assignments for a specific room
     * Used for determining who has access to a particular room
     * 
     * @param roomId the room identifier
     * @return Flux of user assignments for the room
     */
    @Query("""
            SELECT ura.* FROM user_room_assignments ura
            WHERE ura.room_id = :roomId AND ura.is_active = true
            ORDER BY ura.created_at ASC
            """)
    Flux<UserRoomAssignment> findByRoomId(@Param("roomId") String roomId);

    /**
     * Finds a specific assignment for a user-room combination
     * Used for checking permissions and updating existing assignments
     * 
     * @param userId the user's unique identifier
     * @param roomId the room identifier
     * @return Mono containing the assignment if found, empty otherwise
     */
    @Query("""
            SELECT ura.* FROM user_room_assignments ura
            WHERE ura.user_id = :userId AND ura.room_id = :roomId
            AND ura.is_active = true
            LIMIT 1
            """)
    Mono<UserRoomAssignment> findByUserAndRoom(
            @Param("userId") UUID userId,
            @Param("roomId") String roomId);

    /**
     * Checks if a user has access to a specific room
     * Used for quick permission validation without loading the full assignment
     * 
     * @param userId the user's unique identifier
     * @param roomId the room identifier
     * @return Mono<Boolean> true if user has access, false otherwise
     */
    @Query("""
            SELECT COUNT(*) > 0 FROM user_room_assignments ura
            WHERE ura.user_id = :userId AND ura.room_id = :roomId
            AND ura.is_active = true
            """)
    Mono<Boolean> hasRoomAccess(
            @Param("userId") UUID userId,
            @Param("roomId") String roomId);

    /**
     * Checks if a user has control access (not just view-only) to a room
     * Used for validating AC control operations
     * 
     * @param userId the user's unique identifier
     * @param roomId the room identifier
     * @return Mono<Boolean> true if user can control the room, false otherwise
     */
    @Query("""
            SELECT COUNT(*) > 0 FROM user_room_assignments ura
            WHERE ura.user_id = :userId AND ura.room_id = :roomId
            AND ura.is_active = true
            AND ura.access_level IN ('control', 'admin')
            """)
    Mono<Boolean> hasControlAccess(
            @Param("userId") UUID userId,
            @Param("roomId") String roomId);

    /**
     * Checks if a user has admin access to a room
     * Used for administrative operations like quota management
     * 
     * @param userId the user's unique identifier
     * @param roomId the room identifier
     * @return Mono<Boolean> true if user has admin access, false otherwise
     */
    @Query("""
            SELECT COUNT(*) > 0 FROM user_room_assignments ura
            WHERE ura.user_id = :userId AND ura.room_id = :roomId
            AND ura.is_active = true
            AND ura.access_level = 'admin'
            """)
    Mono<Boolean> hasAdminAccess(
            @Param("userId") UUID userId,
            @Param("roomId") String roomId);

    /**
     * Finds assignments by access level
     * Used for filtering users by their permission level
     * 
     * @param accessLevel the access level to filter by
     * @return Flux of assignments with the specified access level
     */
    @Query("""
            SELECT ura.* FROM user_room_assignments ura
            WHERE ura.access_level = :accessLevel AND ura.is_active = true
            ORDER BY ura.created_at ASC
            """)
    Flux<UserRoomAssignment> findByAccessLevel(@Param("accessLevel") AccessLevel accessLevel);

    /**
     * Finds all assignments for users within a household
     * Used for household-wide access management
     * 
     * @param householdId the household identifier
     * @return Flux of assignments for all users in the household
     */
    @Query("""
            SELECT ura.* FROM user_room_assignments ura
            INNER JOIN users u ON ura.user_id = u.id
            WHERE u.household_id = :householdId AND ura.is_active = true
            ORDER BY ura.created_at ASC
            """)
    Flux<UserRoomAssignment> findByHouseholdId(@Param("householdId") UUID householdId);

    /**
     * Finds assignments for a specific room within a household
     * Used for household room management
     * 
     * @param householdId the household identifier
     * @param roomId      the room identifier
     * @return Flux of assignments for the room within the household
     */
    @Query("""
            SELECT ura.* FROM user_room_assignments ura
            INNER JOIN users u ON ura.user_id = u.id
            WHERE u.household_id = :householdId AND ura.room_id = :roomId
            AND ura.is_active = true
            ORDER BY ura.created_at ASC
            """)
    Flux<UserRoomAssignment> findByHouseholdAndRoom(
            @Param("householdId") UUID householdId,
            @Param("roomId") String roomId);

    /**
     * Validates if a user can access a room during the current time
     * Checks both basic access and time window restrictions
     * 
     * @param userId      the user's unique identifier
     * @param roomId      the room identifier
     * @param currentTime the current timestamp to check against time windows
     * @return Mono<Boolean> true if user has time-based access, false otherwise
     */
    @Query("""
            SELECT COUNT(*) > 0 FROM user_room_assignments ura
            WHERE ura.user_id = :userId AND ura.room_id = :roomId
            AND ura.is_active = true
            AND (
                (ura.start_time IS NULL OR ura.start_time <= :currentTime)
                AND (ura.end_time IS NULL OR ura.end_time >= :currentTime)
            )
            """)
    Mono<Boolean> hasTimeBasedAccess(
            @Param("userId") UUID userId,
            @Param("roomId") String roomId,
            @Param("currentTime") LocalDateTime currentTime);

    /**
     * Finds assignments with time restrictions
     * Used for managing and monitoring time-based access controls
     * 
     * @return Flux of assignments that have time restrictions
     */
    @Query("""
            SELECT ura.* FROM user_room_assignments ura
            WHERE ura.is_active = true
            AND (ura.start_time IS NOT NULL OR ura.end_time IS NOT NULL)
            ORDER BY ura.start_time ASC NULLS LAST
            """)
    Flux<UserRoomAssignment> findAssignmentsWithTimeRestrictions();

    /**
     * Finds assignments that are currently within their active time window
     * 
     * @param currentTime the current timestamp
     * @return Flux of assignments currently active based on time windows
     */
    @Query("""
            SELECT ura.* FROM user_room_assignments ura
            WHERE ura.is_active = true
            AND (ura.start_time IS NULL OR ura.start_time <= :currentTime)
            AND (ura.end_time IS NULL OR ura.end_time >= :currentTime)
            ORDER BY ura.created_at ASC
            """)
    Flux<UserRoomAssignment> findCurrentlyActiveAssignments(@Param("currentTime") LocalDateTime currentTime);

    /**
     * Finds assignments that will expire within a specified time period
     * Used for proactive access management and notifications
     * 
     * @param fromTime start of the time window
     * @param toTime   end of the time window
     * @return Flux of assignments expiring within the time window
     */
    @Query("""
            SELECT ura.* FROM user_room_assignments ura
            WHERE ura.is_active = true
            AND ura.end_time IS NOT NULL
            AND ura.end_time >= :fromTime AND ura.end_time <= :toTime
            ORDER BY ura.end_time ASC
            """)
    Flux<UserRoomAssignment> findAssignmentsExpiringBetween(
            @Param("fromTime") LocalDateTime fromTime,
            @Param("toTime") LocalDateTime toTime);

    /**
     * Counts room assignments for a user
     * Used for access management statistics
     * 
     * @param userId the user's unique identifier
     * @return Mono containing the count of room assignments
     */
    @Query("""
            SELECT COUNT(*) FROM user_room_assignments ura
            WHERE ura.user_id = :userId AND ura.is_active = true
            """)
    Mono<Long> countAssignmentsByUser(@Param("userId") UUID userId);

    /**
     * Counts user assignments for a room
     * Used for room access statistics
     * 
     * @param roomId the room identifier
     * @return Mono containing the count of user assignments
     */
    @Query("""
            SELECT COUNT(*) FROM user_room_assignments ura
            WHERE ura.room_id = :roomId AND ura.is_active = true
            """)
    Mono<Long> countAssignmentsByRoom(@Param("roomId") String roomId);

    /**
     * Deactivates assignments by setting is_active to false
     * Used for bulk access management operations
     * 
     * @param assignmentIds array of assignment IDs to deactivate
     * @return Mono containing the number of assignments deactivated
     */
    @Modifying
    @Query("UPDATE user_room_assignments SET is_active = false WHERE id = ANY(:assignmentIds)")
    Mono<Integer> deactivateAssignments(@Param("assignmentIds") UUID[] assignmentIds);

    /**
     * Deactivates all assignments for a specific user
     * Used when removing user access or deactivating a user
     * 
     * @param userId the user's unique identifier
     * @return Mono containing the number of assignments deactivated
     */
    @Modifying
    @Query("UPDATE user_room_assignments SET is_active = false WHERE user_id = :userId")
    Mono<Integer> deactivateAllAssignmentsForUser(@Param("userId") UUID userId);

    /**
     * Deactivates all assignments for a specific room
     * Used when decommissioning or restricting access to a room
     * 
     * @param roomId the room identifier
     * @return Mono containing the number of assignments deactivated
     */
    @Modifying
    @Query("UPDATE user_room_assignments SET is_active = false WHERE room_id = :roomId")
    Mono<Integer> deactivateAllAssignmentsForRoom(@Param("roomId") String roomId);

    /**
     * Updates the access level for an assignment
     * Used for changing user permissions without creating new assignments
     * 
     * @param assignmentId the assignment identifier
     * @param accessLevel  the new access level
     * @return Mono containing the number of rows updated
     */
    @Modifying
    @Query("UPDATE user_room_assignments SET access_level = :accessLevel WHERE id = :assignmentId")
    Mono<Integer> updateAccessLevel(
            @Param("assignmentId") UUID assignmentId,
            @Param("accessLevel") AccessLevel accessLevel);

    /**
     * Extends the end time for an assignment
     * Used for temporary access extensions
     * 
     * @param assignmentId the assignment identifier
     * @param newEndTime   the new end time
     * @return Mono containing the number of rows updated
     */
    @Modifying
    @Query("UPDATE user_room_assignments SET end_time = :newEndTime WHERE id = :assignmentId")
    Mono<Integer> extendAccess(
            @Param("assignmentId") UUID assignmentId,
            @Param("newEndTime") LocalDateTime newEndTime);

    /**
     * Gets room access statistics for a household
     * Returns aggregated data about room assignments and access patterns
     * 
     * @param householdId the household identifier
     * @return Mono containing access statistics as a structured result
     */
    @Query("""
            SELECT
                COUNT(*) as total_assignments,
                COUNT(DISTINCT ura.user_id) as users_with_access,
                COUNT(DISTINCT ura.room_id) as accessible_rooms,
                COUNT(CASE WHEN ura.access_level = 'view_only' THEN 1 END) as view_only_assignments,
                COUNT(CASE WHEN ura.access_level = 'control' THEN 1 END) as control_assignments,
                COUNT(CASE WHEN ura.access_level = 'admin' THEN 1 END) as admin_assignments,
                COUNT(CASE WHEN ura.start_time IS NOT NULL OR ura.end_time IS NOT NULL THEN 1 END) as time_restricted_assignments
            FROM user_room_assignments ura
            INNER JOIN users u ON ura.user_id = u.id
            WHERE u.household_id = :householdId AND ura.is_active = true
            """)
    Mono<Object> getHouseholdAccessStatistics(@Param("householdId") UUID householdId);

    /**
     * Checks if an assignment already exists for a user-room combination
     * Used to prevent duplicate assignments
     * 
     * @param userId the user's unique identifier
     * @param roomId the room identifier
     * @return Mono<Boolean> true if assignment exists, false otherwise
     */
    @Query("""
            SELECT COUNT(*) > 0 FROM user_room_assignments
            WHERE user_id = :userId AND room_id = :roomId AND is_active = true
            """)
    Mono<Boolean> existsByUserAndRoom(
            @Param("userId") UUID userId,
            @Param("roomId") String roomId);

    /**
     * Finds all unique rooms that have at least one user assignment
     * Used for room inventory and management
     * 
     * @return Flux of distinct room IDs with active assignments
     */
    @Query("""
            SELECT DISTINCT ura.room_id FROM user_room_assignments ura
            WHERE ura.is_active = true
            ORDER BY ura.room_id ASC
            """)
    Flux<String> findAllAssignedRooms();

    /**
     * Count total room assignments for a household
     * Used for family statistics
     * 
     * @param householdId the household identifier
     * @return Mono containing the count of room assignments in the household
     */
    @Query("""
            SELECT COUNT(*) FROM user_room_assignments ura
            INNER JOIN users u ON ura.user_id = u.id
            WHERE u.household_id = :householdId AND ura.is_active = true
            """)
    Mono<Long> countByHouseholdId(@Param("householdId") UUID householdId);
}