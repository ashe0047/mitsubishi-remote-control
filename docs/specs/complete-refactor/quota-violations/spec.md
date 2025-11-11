# Spec: Quota Violations API

Status: Draft (spec-driven; implementation gated by approvals)
Owner: Backend Team
Target: backend-2 (NestJS)

## Overview
Expose recording and retrieval of quota violations (exceeding limits, enforcement actions) to match Spring’s repository usage and controller expectations.

## Spring Reference
- Repositories reference: `backend/turing/src/main/java/com/ashelabs/turing/repository/QuotaViolationRepository.java`
- Violations are implied in Spring flows (enforcement + notifications) and surfaced in analytics/reporting.

## Entities (NestJS)
- `quotas/entities/quota-violation.entity.ts`

## Required New Service/Controller
 - `QuotaViolationService`
  - `record(quotaId, userId, roomId, kind, details)`
  - `listByUser(userId, limit?, from?)`
  - `listByRoom(roomId, limit?, from?)`
  - `listByQuota(quotaId, limit?, from?)`
- Controller: `api/quotas/violations`
  - GET `/user/:userId`
  - GET `/room/:roomId`
  - GET `/quota/:quotaId`
  - POST `/` (internal/admin/testing) to create a violation

## API Contract
- Violation shape: `{ id, quotaId, userId, roomId, type, occurredAt, enforcementAction?, message?, metadata? }`
- Pagination via `limit` and `cursor` (optional)
- 401/403 via JWT and role

## Business Rules
- Violations are immutable audit records
- Integrate with `QuotaValidationService` to record on enforcement failure

## Test Plan
- Unit: service record and list methods
- Integration: violation recorded when validation blocks an operation
NOTE (AGENTS.md – Guardrail 1/8): Creating `QuotaViolationService` and a new controller requires explicit approval after presenting a brief plan.
## Dependencies & Sequencing
- Depends on: `QuotaValidationService` to hook recording points
- Implement alongside `quota-crud-and-overrides` so violations can be emitted as overrides/enforcement begin
- Order suggestion: after quota CRUD wiring, before analytics
- See full graph and order: `docs/specs/complete-refactor/SEQUENCING.md`

## Validation Workflow (AGENTS.md)
1) `pnpm build`
2) `pnpm test`
3) `pnpm lint`
4) If failures: STOP and request guidance
