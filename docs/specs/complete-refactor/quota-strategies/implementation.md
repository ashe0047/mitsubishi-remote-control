# Implementation Plan: Quota Strategies

## Steps
1) Complete TODOs in `time-based.strategy.ts`, `energy-based.strategy.ts`, `cost-based.strategy.ts`, `usage-based.strategy.ts`
2) Add helper period calculator in `QuotaCalculationEngine` if needed
3) Extend `QuotaValidationService` unit tests to cover all strategies and override interactions
4) Add formatting helpers for outputs (already present in engine)

## Acceptance Criteria
- All strategies compute used/remaining correctly for edge cases
- Validation results respect overrides and enforcement actions

## Validation Workflow (AGENTS.md)
- Build: `pnpm build`
- Test: `pnpm test`
- Lint: `pnpm lint`
- Stop/revert on failures and request guidance
