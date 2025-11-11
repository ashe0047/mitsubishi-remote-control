# Spec: Quota Calculation Strategies (Time, Energy, Cost, Usage)

Status: Draft (spec-driven; implementation gated by approvals)
Owner: Backend Team
Target: backend-2 (NestJS)

## Overview
Complete and verify quota calculation strategies used by `QuotaValidationService`. Implement missing logic in energy-based and cost-based strategies and finalize time-based checks.

## Spring Reference
- Spring centralizes quota logic in services and repositories referenced by `QuotaController` and validation flows. While there are no 1:1 strategy classes, the behavior is implied by fields: `allowedAmount`, `usedAmount`, `period`, `enforcementAction` and by validation/status endpoints.

## Strategy Implementations (NestJS)
- Files:
  - `backend-2/src/quotas/strategies/time-based.strategy.ts`
  - `backend-2/src/quotas/strategies/energy-based.strategy.ts`
  - `backend-2/src/quotas/strategies/cost-based.strategy.ts`
  - `backend-2/src/quotas/strategies/usage-based.strategy.ts`

## Definitions
- Time-based: allowedAmount in seconds or minutes; compute `used` from active and completed sessions within period; block if `used >= allowed` unless override active.
- Energy-based: allowedAmount in kWh; sum `energy_kwh` from sessions in period.
- Cost-based: allowedAmount in currency; sum `cost` or derive `energy_kwh * rate`; default `rate = 0.15` unless configured.
- Usage-based: allowedAmount in generic units (e.g., command-count); sum `usage` from sessions.

## Business Rules
- Periods: daily/weekly/monthly; filter sessions within current period window. Support custom `periodStart` and `resetTime` where present.
- Enforcement Actions: BLOCK (deny), WARN (allow + emit warning), THROTTLE (allow with limits). Map to validation result for WebSocket/device control.
- Overrides: if an active approved override exists for the user/room/period, allow according to override type (unlock day, emergency bypass, add time).

## Data Sources
- Sessions: `UsageSessionService` aggregations per (userId, roomId, deviceId, quotaId)
- Overrides: `QuotaOverride` repository
- Cache: `QuotaCacheService` for preloaded/user-room cache entries

## Outputs
- `QuotaValidationResult` fields: `{ allowed: boolean, reason?: string, remaining: number, used: number, limit: number, enforcementAction?: string }`

## Error Handling
- Treat missing metrics as zero; protect against NaN
- Ensure exhaustive type checks; no runtime `any`

## Test Plan
- Unit: for each strategy, given sessions and limits, validate allow/block and remaining computation (edge: exactly at limit; just over; with override)
- Integration: `QuotaValidationService.validateQuotaUsage` selects proper strategy by `quotaType` and respects overrides and cache hits

## Dependencies & Sequencing
- Depends on: `UsageSessionService` aggregations, `QuotaOverride` reads
- Coordinate with: `quota-crud-and-overrides` (ensure consistent semantics)
- Recommended order: after CRUD service skeleton exists so strategies can be exercised via API; can be developed in parallel if contracts are stable
- See full graph and order: `docs/specs/complete-refactor/SEQUENCING.md`

## Validation Workflow (AGENTS.md)
1) `pnpm build`
2) `pnpm test`
3) `pnpm lint`
4) If failures: STOP and request guidance
