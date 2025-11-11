# Implementation Plan: Quota Violations API

## Steps
1) Add `QuotaViolationService` with methods: record, listByUser, listByRoom, listByQuota
2) Add `QuotaViolationsController` exposing routes per spec
3) Inject service into `QuotaValidationService` to record on enforcement failures
4) Tests: unit for service and controller; integration with validation flows

## Acceptance Criteria
- Violations persist and list correctly by filters
- Validation flow records violation on BLOCK enforcement

## Validation Workflow (AGENTS.md)
- Build: `pnpm build`
- Lint: `pnpm lint`
- Tests: `pnpm test`
- On failure: STOP and request guidance
