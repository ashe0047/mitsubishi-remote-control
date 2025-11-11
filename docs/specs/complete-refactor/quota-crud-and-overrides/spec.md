# Spec: Quota CRUD, Status, and Overrides

Status: Draft (spec-driven; implementation gated by approvals)
Owner: Backend Team
Target: backend-2 (NestJS)

## Overview
Implement quota CRUD, current status retrieval, and parent override operations to achieve parity with Spring’s QuotaController. Integrate cache invalidation and session alignment with existing validation/engine services.

## Goals
- API parity with Spring endpoints used by the PWA
- Strong typing and DTO validation; no `any`/unsafe casts
- Deterministic cache behavior (preload, invalidate) with observable metrics
- Backwards-compatible URLs under `/api/quotas/*`

## Non-Goals
- UI changes
- New database schema beyond existing entities (unless required and approved)

## Spring Reference
- File: backend/turing/src/main/java/com/ashelabs/turing/controller/QuotaController.java
  - POST /api/quotas (create or update active quota)
  - GET  /api/quotas/user/{userId}?roomId=... (current balance)
  - POST /api/quotas/{quotaId}/override (ADD_TIME, UNLOCK_DAY, EMERGENCY_OVERRIDE)
  - GET  /api/quotas/user/{userId}/all (list all user quotas)

## Entities (NestJS)
- `quotas/entities/quota.entity.ts`
- `quotas/entities/quota-override.entity.ts`
- `quotas/entities/quota-violation.entity.ts`
- `quotas/entities/usage-session.entity.ts`

## Services (Existing)
- `QuotaValidationService` (validate balance & operations)
- `QuotaCalculationEngine` (formatters and calculations)
- `QuotaCacheService` (Redis cache and stats)
- `UsageSessionService` (sessions)

## Required New Services
- `QuotaService`
  - createOrUpdateQuota(userId, roomId, dto)
  - findActiveByUserAndRoom(userId, roomId)
  - getAllByUser(userId)
  - getById(id), update(id, dto), delete(id)
  - Hooks: invalidate `QuotaCacheService` on writes
- `QuotaOverrideService`
  - requestAddTime(quotaId, addedSeconds, reason, requestedBy)
  - requestUnlockDay(quotaId, reason, requestedBy)
  - requestEmergencyOverride(quotaId, reason, requestedBy)
  - approve(id, approvedBy), reject(id, rejectedBy), cancel(id)
  - lifecycle transitions and computed getters align with entity methods

- NOTE (AGENTS.md – Guardrail 1/3/8): New services (`QuotaService`, `QuotaOverrideService`) are subject to “No New Files Without Explicit Approval” and “Explain Before Performing”. Submit a short plan and wait for approval before creating files.

## API Contract (NestJS)

Base: `/api/quotas` (JWT required)

- POST `/`
  - Body: `CreateQuotaDto` fields aligning to Spring’s CreateQuotaRequest:
    - `userId`, `roomId` (→ `targetId`), `quotaType`, `allowedAmount`, `warningThreshold`
  - Logic: if active quota exists for user+room (period-aware), update fields; else create new
  - AuthZ: parent only
  - 200 returns saved `Quota`

- GET `/user/:userId`
  - Query: `roomId`
  - Returns `QuotaBalance` (mirror Spring’s `com.ashelabs.turing.dto.QuotaBalance`)
  - Uses `QuotaValidationService.getCurrentQuotaBalance(UUID userId, String roomId)` equivalent

- GET `/user/:userId/all`
  - Returns all quotas for the user (parent visibility)

- POST `/:quotaId/override`
  - Body: `{ type: 'ADD_TIME'|'UNLOCK_DAY'|'EMERGENCY_OVERRIDE', additionalSeconds?: number, reason?: string }`
  - AuthZ: parent only
  - Behavior:
    - ADD_TIME: extend allowance/session time by seconds
    - UNLOCK_DAY: mark today as unlocked (no enforcement)
    - EMERGENCY_OVERRIDE: temporarily bypass enforcement
  - Response: `{ message, quotaId, overrideType, grantedAt }`

- Standard CRUD (optional external admin)
  - GET `/:id`, PUT `/:id`, DELETE `/:id`

## Business Rules
- Period awareness (daily/weekly/monthly) required to determine active quota
- Update path modifies `allowedAmount`, `quotaType`, `warningThresholds`, timestamps
- Cache invalidation on create/update/delete and after override grant
- Overrides affect enforcement checks in `QuotaValidationService`

## Error Handling
- 401/403 based on JWT and role (parent)
- 400 for unknown override type or invalid inputs
- 404 when quotaId not found

## Side Effects
- Record overrides for audit; update active sessions if time is added
- Emit WebSocket quota updates via `QuotaGateway` (subscribe/unsubscribe streams) where applicable

## Test Plan
- Unit: `QuotaService` active find + update-or-create; `QuotaOverrideService` transitions
- Contract: parity response shapes to Spring; especially `QuotaBalance` and override response
- Integration: cache invalidation observed via `quota-cache.service` stats

## Migration Notes
- Map Spring’s `CreateQuotaRequest` fields to Nest DTOs (`create-quota.dto.ts` already present)
- Keep Spring URLs compatible by maintaining path structure under `/api/quotas/*`

## Dependencies & Sequencing
- Depends on: `QuotaValidationService`, `QuotaCacheService`, `UsageSessionService`, entities (present)
- Related: `quota-strategies` (should be completed or stubbed predictably)
- See full graph and order: `docs/specs/complete-refactor/SEQUENCING.md`

## Validation Workflow (AGENTS.md)
Run after each change set:
1) Install/build: `pnpm install && pnpm build`
2) Tests: `pnpm test` and `pnpm test:e2e` (when added)
3) Lint: `pnpm lint`
4) If failures occur: STOP, revert, and request guidance
