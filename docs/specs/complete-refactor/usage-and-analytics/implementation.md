# Implementation Plan: Usage & Analytics

## Steps
1) Add `UsageController` with `/summary/:userId` and `/sessions/:userId` routes
2) Add `AnalyticsController` with `/user/:userId/usage` route
3) Implement aggregations in `UsageSessionService`
4) Validate query params and fallback to defaults
5) Tests: unit for service aggregations; E2E for controller responses

## Acceptance Criteria
- Responses match contracts and Spring parity maps
- Correct filtering by date range and optional roomId

## Validation Workflow (AGENTS.md)
- Build: `pnpm build`
- Lint: `pnpm lint`
- Test: `pnpm test`
- Stop/revert on failures, request guidance
