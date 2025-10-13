package com.ashelabs.turing.repository;

import com.ashelabs.turing.entity.FamilyInvitation;
import com.ashelabs.turing.entity.InvitationStatus;
import org.springframework.data.r2dbc.repository.Modifying;
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.data.repository.query.Param;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.UUID;

/**
 * Repository interface for family invitation data access operations.
 * Provides methods for managing invitation lifecycle and queries.
 */
public interface FamilyInvitationRepository extends R2dbcRepository<FamilyInvitation, UUID> {

    /**
     * Find all invitations for a specific household
     */
    @Query("SELECT * FROM family_invitations WHERE household_id = :householdId ORDER BY created_at DESC")
    Flux<FamilyInvitation> findByHouseholdId(@Param("householdId") UUID householdId);

    /**
     * Find invitation by token for validation and acceptance
     */
    @Query("SELECT * FROM family_invitations WHERE token = :token")
    Mono<FamilyInvitation> findByToken(@Param("token") String token);

    /**
     * Find invitation by email and household (to prevent duplicate invitations)
     */
    @Query("SELECT * FROM family_invitations WHERE email = :email AND household_id = :householdId AND status = 'pending'")
    Mono<FamilyInvitation> findPendingInvitationByEmailAndHousehold(
        @Param("email") String email, 
        @Param("householdId") UUID householdId
    );

    /**
     * Find all pending invitations for a household
     */
    @Query("SELECT * FROM family_invitations WHERE household_id = :householdId AND status = 'pending' ORDER BY created_at DESC")
    Flux<FamilyInvitation> findPendingInvitationsByHousehold(@Param("householdId") UUID householdId);

    /**
     * Find all invitations sent by a specific user
     */
    @Query("SELECT * FROM family_invitations WHERE invited_by_user_id = :userId ORDER BY created_at DESC")
    Flux<FamilyInvitation> findByInvitedByUserId(@Param("userId") UUID userId);

    /**
     * Find all expired invitations that need to be marked as expired
     */
    @Query("SELECT * FROM family_invitations WHERE status = 'pending' AND expires_at < :now")
    Flux<FamilyInvitation> findExpiredInvitations(@Param("now") Instant now);

    /**
     * Mark expired invitations as expired
     */
    @Modifying
    @Query("UPDATE family_invitations SET status = 'expired', updated_at = :now WHERE status = 'pending' AND expires_at < :now")
    Mono<Integer> markExpiredInvitations(@Param("now") Instant now);

    /**
     * Count pending invitations for a household
     */
    @Query("SELECT COUNT(*) FROM family_invitations WHERE household_id = :householdId AND status = 'pending'")
    Mono<Long> countPendingInvitationsByHousehold(@Param("householdId") UUID householdId);

    /**
     * Count total invitations sent by a user
     */
    @Query("SELECT COUNT(*) FROM family_invitations WHERE invited_by_user_id = :userId")
    Mono<Long> countInvitationsByUser(@Param("userId") UUID userId);

    /**
     * Find invitations by status for a household
     */
    @Query("SELECT * FROM family_invitations WHERE household_id = :householdId AND status = :status ORDER BY created_at DESC")
    Flux<FamilyInvitation> findByHouseholdIdAndStatus(
        @Param("householdId") UUID householdId, 
        @Param("status") InvitationStatus status
    );

    /**
     * Find recent invitations for a household (last 30 days)
     */
    @Query("SELECT * FROM family_invitations WHERE household_id = :householdId AND created_at > :since ORDER BY created_at DESC")
    Flux<FamilyInvitation> findRecentInvitationsByHousehold(
        @Param("householdId") UUID householdId, 
        @Param("since") Instant since
    );

    /**
     * Delete old expired invitations (cleanup operation)
     */
    @Modifying
    @Query("DELETE FROM family_invitations WHERE status IN ('expired', 'declined', 'cancelled') AND updated_at < :cutoff")
    Mono<Integer> deleteOldInvitations(@Param("cutoff") Instant cutoff);

    /**
     * Find invitation by email for checking if user has pending invitations
     */
    @Query("SELECT * FROM family_invitations WHERE email = :email AND status = 'pending' ORDER BY created_at DESC")
    Flux<FamilyInvitation> findPendingInvitationsByEmail(@Param("email") String email);

    /**
     * Cancel all pending invitations for an email (when user registers directly)
     */
    @Modifying
    @Query("UPDATE family_invitations SET status = 'cancelled', updated_at = :now WHERE email = :email AND status = 'pending'")
    Mono<Integer> cancelPendingInvitationsForEmail(@Param("email") String email, @Param("now") Instant now);
}