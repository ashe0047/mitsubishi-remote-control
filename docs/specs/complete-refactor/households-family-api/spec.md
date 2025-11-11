# Spec: Households & Family Invitations API

Status: Draft (spec-driven; implementation gated by approvals)
Owner: Backend Team
Target: backend-2 (NestJS)

## Overview
Implement household membership and invitations endpoints in NestJS to reach parity with Spring Boot FamilyController. This exposes invite, accept/decline, validate, cancel, and list operations, plus optional family usage summary.

## Goals
- Parity with Spring invitation lifecycle and members listing
- Strong role enforcement (parent-only for send/cancel)
- Token-based flows that don’t leak secrets

## Non-Goals
- Email delivery mechanics (out of scope)
- UI changes

## Scope
- New controller: `api/households` (or `api/family` for strict parity)
- Use existing entities: `Household`, `FamilyInvitation`, `User`, `UserRoomAssignment`
- Use existing service: `HouseholdsService`; add `FamilyInvitationsService` (if needed)

## Spring Reference
- File: backend/turing/src/main/java/com/ashelabs/turing/controller/FamilyController.java
  - POST /api/family/invitations (send)
  - POST /api/family/invitations/accept
  - POST /api/family/invitations/decline
  - POST /api/family/invitations/validate
  - POST /api/family/invitations/cancel
  - GET  /api/family/invitations (list by household)
  - GET  /api/family/members (list household members)
  - GET  /api/family/usage (summary; mock in Spring)

## API Contract (NestJS)

Base: `/api/households` (JWT required)

- POST `/invitations`
  - Body: `{ email: string, name?: string, role?: 'parent'|'child', message?: string }`
  - AuthZ: parent only
  - 201/200 on success with `FamilyInvitation` (without secret token in response)
  - 400 if pending invitation exists, 403 if not parent

- POST `/invitations/accept`
  - Body: `{ token: string, name?: string, email?: string, password?: string }`
  - Creates a user in household, marks invitation accepted
  - 201 with created `User`
  - 400 invalid/expired token

- POST `/invitations/decline`
  - Body: `{ token: string }`
  - Marks invitation declined
  - 200 `{ message }` or 400 invalid state/token

- POST `/invitations/validate`
  - Body: `{ token: string }`
  - 200 `{ valid: boolean, email, name, role, expiresAt }`

- POST `/invitations/cancel`
  - Body: `{ invitationId: string }`
  - AuthZ: parent only; marks invitation cancelled if pending
  - 200 `{ message }` or 400/403

- GET `/invitations`
  - Query: `status?: pending|accepted|declined|cancelled|expired`
  - Lists invitations in current user’s household

- GET `/members`
  - Lists users in household; minimal public profile fields

- GET `/usage`
  - Query: `period=daily|weekly|monthly`
  - Returns family usage summary (phase 2; can start with placeholder matching Spring mock shape)

## Data Model & Rules
- Invitation token: random URL-safe Base64 (32 bytes) with 7-day expiry (see Spring generateInvitationToken())
- Allowed roles: parent, child; default child
- State machine: pending → accepted|declined|cancelled|expired
- Accept joins user to `household_id` and sets `UserRole` from invitation
- Prevent duplicate pending invitation for same email + household

## Error Handling
- 401 if no JWT; 403 for non-parent ops
- 400 for invalid token/state; 404 for missing resources
- Use central `ErrorsModule` for formatting

## Side Effects
- On accept: create User and set `household_id`, mark invitation accepted with `accepted_by_user_id`
- On cancel/decline: update invitation state, do not affect users

## Non-Functional
- Rate limit send-invitation to deter abuse (future)
- Log audit events for invitation lifecycle

## Test Plan
- Unit: service methods for create/validate/accept/decline/cancel/expire
- E2E: full flow send → validate → accept; send → cancel; decline path; duplicate check
- Edge: expired token, role defaulting, parent-only guards

## Migration Notes
- Spring paths under `/api/family/*`; Nest path proposed `/api/households/*`. Provide router alias `/api/family/*` if clients expect Spring paths.

## Dependencies & Sequencing
- Depends on: `UsersService`, `HouseholdsService`, `FamilyInvitation` entity
- Independent of quota stack; can ship separately
- Recommended global order: after `quota-crud-and-overrides` if we prioritize quota parity first
- See full graph and order: `docs/specs/complete-refactor/SEQUENCING.md`

## Validation Workflow (AGENTS.md)
1) `pnpm build`
2) `pnpm test` (add unit + e2e for invite lifecycle)
3) `pnpm lint`
4) If any fail: STOP and request guidance
