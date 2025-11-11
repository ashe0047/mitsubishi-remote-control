/**
 * Family Invitation Enumeration Types
 * Matches Spring Boot enums exactly
 */

export enum InvitationStatus {
  PENDING = 'PENDING', // PostgreSQL UPPER_SNAKE_CASE convention
  ACCEPTED = 'ACCEPTED', // PostgreSQL UPPER_SNAKE_CASE convention
  DECLINED = 'DECLINED', // PostgreSQL UPPER_SNAKE_CASE convention
  EXPIRED = 'EXPIRED', // PostgreSQL UPPER_SNAKE_CASE convention
  CANCELLED = 'CANCELLED', // PostgreSQL UPPER_SNAKE_CASE convention
}
