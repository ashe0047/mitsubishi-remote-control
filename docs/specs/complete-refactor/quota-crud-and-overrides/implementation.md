# Implementation Plan: Quota CRUD, Status, and Overrides

## Steps
Gate 0 (Explain & Approve per AGENTS.md #8): Submit summary of new services (names, methods, files) and await approval.

Gate 1 (Services):
1) Create `QuotaService` (APPROVED) with repository injections; implement:
   - `findActiveByUserAndRoom(userId, roomId, now)`
   - `createOrUpdateQuota(userId, roomId, dto)`
   - `getAllByUser(userId)`, `getById(id)`, `update(id, dto)`, `delete(id)`
2) Create `QuotaOverrideService` (APPROVED) with lifecycle methods; ensure entity helpers used (approve/reject/cancel)
3) Add cache hooks: `QuotaCacheService.invalidate(userId, roomId)` after writes

Gate 2 (Controller wiring):
4) Fill `quotas/controllers/quota.controller.ts` TODOs: POST create/update; GET user status; GET user all; CRUD by id; POST override
5) Authorize parent-only writes using `RolesGuard`; ensure JWT extraction via `@CurrentUser`

Gate 3 (WebSocket + Telemetry):
6) Emit quota updates via `QuotaGateway` where applicable
7) Add structured logs and counters

Gate 4 (Validation & Tests):
8) DTO validation with class-validator; strict unions, no non-null assertions
9) Tests: unit for services; E2E for controller routes and cache behavior

## Mapping to Spring

## Mapping to Spring
- Parity with `QuotaController` endpoints and behaviors (create-or-update; status; override types)

## Acceptance Criteria
- Endpoints return expected shapes and codes
- Overrides transition correctly and affect enforcement
- Cache invalidated on writes; metrics visible via cache stats

## Post-Change Validation (AGENTS.md #6)
Run in backend-2/:
- `pnpm build`
- `pnpm test && pnpm test:e2e`
- `pnpm lint`

