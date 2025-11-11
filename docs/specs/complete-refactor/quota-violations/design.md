# Design: Quota Violations API

## Architecture
- New `QuotaViolationsController` under `api/quotas/violations`
- `QuotaViolationService` encapsulates persistence and queries
- Integrates with `QuotaValidationService` to record violations

## DTOs
- CreateViolationDto: `{ quotaId: string; userId: string; roomId: string; type: string; message?: string; metadata?: Record<string, unknown> }`
- Query params: `{ limit?: number; cursor?: string }`

## Queries & Indexing
- Index by `user_id`, `room_id`, `quota_id`, `occurred_at`
- Support time-window filters in service in future

## Error Handling
- 404 on missing related records if using strict FK checks
- Centralized formatting via `ErrorsModule`

## Sequencing & Approvals
- Gate A: Present controller/service/DTO plan and wait for approval
- Phase 1: Service + repository methods
- Phase 2: Controller routes + DTOs
- Phase 3: Integrate call sites in `QuotaValidationService`
