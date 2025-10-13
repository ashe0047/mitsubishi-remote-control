package com.ashelabs.turing.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.util.UUID;

/**
 * Room entity representing a physical room in a household.
 *
 * Rooms are the primary organizational unit for devices and access control.
 * Each room belongs to a household and can have multiple devices assigned to it.
 */
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@Table("rooms")
public class Room extends BaseEntity {

    /**
     * Foreign key to households table
     * All rooms belong to exactly one household (multi-tenant isolation)
     */
    @Column("household_id")
    private UUID householdId;

    /**
     * Human-readable room name
     * Example: "Living Room", "Master Bedroom"
     *
     * Constraints:
     * - Length: 2-100 characters
     * - Unique within household
     */
    @Column("name")
    private String name;

    /**
     * Room identifier (slug) used as stable business key
     * Example: "living-room", "master-bedroom"
     *
     * This is used by room assignments and device references.
     * Generated from name using RoomIdentifierGenerator.
     *
     * Constraints:
     * - Pattern: ^[a-z0-9]+(-[a-z0-9]+)*$
     * - Unique within household
     */
    @Column("room_identifier")
    private String roomIdentifier;

    /**
     * Optional location/floor information
     * Example: "Ground Floor", "First Floor", "Basement"
     *
     * Constraints:
     * - Maximum length: 100 characters
     */
    @Column("location")
    private String location;

    /**
     * Optional room description
     * Example: "Main living area with AC and entertainment system"
     *
     * Constraints:
     * - Maximum length: 500 characters
     */
    @Column("description")
    private String description;
}
