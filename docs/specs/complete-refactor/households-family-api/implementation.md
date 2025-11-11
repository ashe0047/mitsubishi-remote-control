# Implementation Plan: Households & Family Invitations API

## Steps
1) Controller: `HouseholdsController` under `api/households`
   - Wire routes per spec; use `@UseGuards(JwtAccessGuard, RolesGuard)` where needed
2) Service: `FamilyInvitationsService`
   - Methods: send, validate, accept, decline, cancel, listByHousehold
   - Token generation and expiry checks
   - Duplicate pending check
3) Repositories
   - Use TypeORM repositories for `FamilyInvitation`, `User`, `Household`
4) DTOs & Validation
   - Define DTOs with class-validator constraints
5) Authorization
   - Parent-only checks via `RolesGuard` (role from JWT claims)
6) Error Handling
   - Use `ErrorsModule` to format and log errors
7) Tests
   - Unit tests for service methods
   - E2E route tests for full flows

## Mapping to Spring
- Logic and endpoints mirror `FamilyController.java`; token generation uses same 32-byte URL-safe base64 approach; 7-day expiry; state machine.

## Acceptance Criteria
- All routes respond per contract
- Duplicate pending invite prevented
- Accept creates user and associates with household
- Decline/cancel transitions enforced

## Sequencing & Validation (AGENTS.md)
- Gate 0: Submit plan for new files (controller/service/DTOs) and wait approval
- Build → Lint → Test each phase:
  - `pnpm build` then `pnpm lint`
  - Add and run unit/e2e tests incrementally: `pnpm test`
  - On failure: STOP and revert changes as necessary; request guidance
