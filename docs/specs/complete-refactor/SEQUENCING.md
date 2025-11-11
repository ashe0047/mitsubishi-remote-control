# Complete Refactor Sequencing and Dependencies

This document defines cross-spec dependencies and the recommended implementation order for `docs/specs/complete-refactor/*` per the spec‑driven workflow in AGENTS.md.

## Specs
- quota-crud-and-overrides
- quota-violations
- quota-strategies
- websockets-aircon-validation-metrics
- usage-and-analytics
- households-family-api
- device-rest-parity (optional)

## Dependency Graph (high level)
- quota-crud-and-overrides → quota-violations
- quota-crud-and-overrides → quota-strategies
- quota-crud-and-overrides → usage-and-analytics (indirect, via sessions & quotas being stable)
- quota-violations → usage-and-analytics (violations appear in analytics/reporting)
- quota-strategies → usage-and-analytics (accurate totals rely on finalized strategies)
- websockets-aircon-validation-metrics → none of the above (independent), but recommended after quota-crud to align access validation patterns
- households-family-api → independent (users/households only)
- device-rest-parity → independent (optional; depends on DevicesService)

## Recommended Implementation Order (Phased)
1) quota-crud-and-overrides
   - Rationale: core quota lifecycle and cache hooks unblock everything else.
2) quota-violations
   - Rationale: record enforcement outcomes for parity and analytics.
3) quota-strategies
   - Rationale: finalize calculations so downstream analytics produce accurate results.
4) websockets-aircon-validation-metrics
   - Rationale: improve observability and validation once core APIs are in place.
5) usage-and-analytics
   - Rationale: relies on stable sessions/quotas/violations and strategy math.
6) households-family-api
   - Rationale: independent; schedule after quota work to focus on parity first (can be moved earlier if needed).
7) device-rest-parity (optional)
   - Rationale: only needed if clients require Spring’s granular endpoints.

## Per‑Spec Prerequisites
- quota-crud-and-overrides
  - Existing: `QuotaValidationService`, `QuotaCacheService`, `UsageSessionService`, entities
- quota-violations
  - Requires: quota CRUD wired; hook points in `QuotaValidationService`
- quota-strategies
  - Requires: session aggregation access; entity semantics stable from CRUD
- websockets-aircon-validation-metrics
  - Requires: `RoomsService`, `DevicesService`, `ErrorHandlerService` (present)
- usage-and-analytics
  - Requires: session aggregations and finalized strategies for accurate metrics
- households-family-api
  - Requires: `UsersService`, `HouseholdsService`, `FamilyInvitation` entity (present)
- device-rest-parity (optional)
  - Requires: `DevicesService` (present) and confirmation of client need

## Validation Workflow (AGENTS.md)
For each phase:
- Build: `pnpm build`
- Lint: `pnpm lint`
- Tests: `pnpm test` (and `pnpm test:e2e` once available)
- On failure: STOP, revert, request guidance

