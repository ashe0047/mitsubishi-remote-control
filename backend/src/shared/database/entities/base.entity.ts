import {
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Abstract base entity that provides common audit fields and primary key.
 * All entities should extend this to inherit id, createdAt and updatedAt fields.
 *
 * This follows the DRY principle by eliminating code duplication
 * and ensures consistent timestamp handling across all entities.
 *
 * Matches Spring Boot BaseEntity structure exactly.
 */
export abstract class BaseEntity {
  /**
   * Primary key using UUID
   * Matches Spring Boot @Id @Column("id") protected UUID id;
   */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Timestamp when the entity was created
   * Automatically set by TypeORM on entity creation
   * Matches Spring Boot @CreatedDate @Column("created_at") protected Instant createdAt;
   */
  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp with time zone',
  })
  createdAt!: Date;

  /**
   * Timestamp when the entity was last updated
   * Automatically updated by TypeORM on any entity modification
   * Matches Spring Boot @LastModifiedDate @Column("updated_at") protected Instant updatedAt;
   */
  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp with time zone',
  })
  updatedAt!: Date;
}
