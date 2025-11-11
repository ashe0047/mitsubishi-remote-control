/**
 * User Enumeration Types
 *
 * These enums match the database custom types for user management
 */

export enum UserRole {
  ADMIN = 'ADMIN', // PostgreSQL UPPER_SNAKE_CASE convention
  PARENT = 'PARENT', // PostgreSQL UPPER_SNAKE_CASE convention
  ADULT = 'ADULT', // PostgreSQL UPPER_SNAKE_CASE convention
  TEEN = 'TEEN', // PostgreSQL UPPER_SNAKE_CASE convention
  CHILD = 'CHILD', // PostgreSQL UPPER_SNAKE_CASE convention
  GUEST = 'GUEST', // PostgreSQL UPPER_SNAKE_CASE convention
}

export enum UserStatus {
  ACTIVE = 'ACTIVE', // PostgreSQL UPPER_SNAKE_CASE convention
  SUSPENDED = 'SUSPENDED', // PostgreSQL UPPER_SNAKE_CASE convention
  PENDING = 'PENDING', // PostgreSQL UPPER_SNAKE_CASE convention
  ARCHIVED = 'ARCHIVED', // PostgreSQL UPPER_SNAKE_CASE convention
}
