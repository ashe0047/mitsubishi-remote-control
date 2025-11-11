/**
 * Usage Session Enums - Database Schema Alignment
 * Matches Spring Boot enums exactly
 */

export enum SessionStatus {
  ACTIVE = 'ACTIVE', // Matches Spring Boot SessionStatus.ACTIVE
  COMPLETED = 'COMPLETED', // Matches Spring Boot SessionStatus.COMPLETED
  INTERRUPTED = 'INTERRUPTED', // Matches Spring Boot SessionStatus.INTERRUPTED
  OVERRIDE = 'OVERRIDE', // Matches Spring Boot SessionStatus.OVERRIDE
}
