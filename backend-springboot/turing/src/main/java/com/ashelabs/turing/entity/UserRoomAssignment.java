package com.ashelabs.turing.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * UserRoomAssignment entity representing many-to-many relationship defining user access to specific rooms
 * Corresponds to the 'user_room_assignments' table in the database
 */
@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@SuperBuilder
@Table("user_room_assignments")
public class UserRoomAssignment extends BaseEntity {
    
    /**
     * Reference to the user
     */
    @NotNull(message = "User ID is required")
    @Column("user_id")
    private UUID userId;
    
    /**
     * Room identifier from the existing configuration system
     */
    @NotBlank(message = "Room ID cannot be empty")
    @Column("room_id")
    private String roomId;
    
    /**
     * Access level for this user in this room
     */
    @NotNull(message = "Access level is required")
    @Column("access_level")
    @Builder.Default
    private AccessLevel accessLevel = AccessLevel.limited;
    
    /**
     * Start time for time-limited access
     */
    @Column("valid_from")
    private Instant validFrom;
    
    /**
     * End time for time-limited access
     */
    @Column("valid_until")
    private Instant validUntil;
    
    /**
     * Schedule configuration stored as JSONB
     * Example: {"monday": "09:00-17:00", "weekend": "all_day", "tuesday": "off"}
     */
    @Column("schedule")
    private JsonNode schedule;
    
    /**
     * Actions allowed for this user in this room stored as JSONB array
     * Example: ["power", "temperature", "fan", "mode"]
     */
    @Column("allowed_actions")
    private JsonNode allowedActions;
    
    /**
     * Actions restricted for this user in this room stored as JSONB array
     * Example: ["vane", "wideVane", "system"]
     */
    @Column("restricted_actions")
    private JsonNode restrictedActions;
    
    /**
     * User who created this assignment
     */
    @Column("created_by")
    private UUID createdBy;
}