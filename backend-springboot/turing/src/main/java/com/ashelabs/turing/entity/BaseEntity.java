package com.ashelabs.turing.entity;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.relational.core.mapping.Column;

import java.time.Instant;
import java.util.UUID;

/**
 * Base entity class providing common audit fields for all entities
 * Uses Spring Data R2DBC annotations for reactive database operations
 */
@Data
@NoArgsConstructor
@SuperBuilder
public abstract class BaseEntity {
    
    /**
     * Primary key using UUID for all entities
     */
    @Id
    @Column("id")
    protected UUID id;
    
    /**
     * Timestamp when the entity was created
     */
    @CreatedDate
    @Column("created_at")
    protected Instant createdAt;
    
    /**
     * Timestamp when the entity was last modified
     */
    @LastModifiedDate
    @Column("updated_at")
    protected Instant updatedAt;
}