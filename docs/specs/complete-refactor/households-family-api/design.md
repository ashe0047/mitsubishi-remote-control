# Design: Households & Family Invitations API

## Architecture
- Module: `HouseholdsModule` (exists) + new `HouseholdsController`
- Optional new `FamilyInvitationsService` for invitation lifecycle
- Entities: `Household`, `FamilyInvitation`, `User`
- Guards: `JwtAccessGuard`, `RolesGuard` (parent-only routes)
- Errors: `ErrorsModule` for formatting and logging

## Routes & DTOs
- POST `/api/households/invitations`
  - DTO: `SendInvitationDto { email: string; name?: string; role?: 'parent'|'child'; message?: string }`
- POST `/api/households/invitations/accept`
  - DTO: `AcceptInvitationDto { token: string; name?: string; email?: string; password?: string }`
- POST `/api/households/invitations/decline`
  - DTO: `DeclineInvitationDto { token: string }`
- POST `/api/households/invitations/validate`
  - DTO: `ValidateInvitationDto { token: string }`
- POST `/api/households/invitations/cancel`
  - DTO: `CancelInvitationDto { invitationId: string }`
- GET `/api/households/invitations?status=...`
- GET `/api/households/members`
- GET `/api/households/usage?period=...` (phase 2)

## Invitation Token & State
- Token: 32-byte random URL-safe Base64
- Expiry: 7 days from `sentAt`
- Status: `pending|accepted|declined|cancelled|expired`
- Transition rules copied from Spring logic

## Authorization
- Parent-only: send, cancel
- Open with token: accept, decline, validate
- Household-scoped lists guarded by `JwtAccessGuard`

## Data Flow
1) Parent sends invitation → create row with token/expiry/status=pending
2) Recipient validates token → returns metadata (no PII leakage beyond email/name/role)
3) Accept → create user, set `household_id`, mark invitation accepted
4) Decline/Cancel → update status accordingly

## Risks & Mitigations
- Duplicate invites: enforce unique pending per (household,email)
- Token leakage: never return token after creation; only accept path uses it
- Abuse: add rate limiting (future) and audit logs

## Observability
- Structured logs: action, invitationId, householdId, userId
- Metrics: counts by status transitions

## Sequencing & Approvals
- Gate A (Explain Before Performing): present controller/service/DTO list for approval (AGENTS.md #8)
- Phase 1: Controller scaffolding + DTOs + parent-only guards
- Phase 2: Service methods (send/validate/accept/decline/cancel) + repository queries
- Phase 3: E2E tests for end-to-end flows

