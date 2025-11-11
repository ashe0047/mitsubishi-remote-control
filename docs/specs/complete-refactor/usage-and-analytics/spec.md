# Spec: Usage Summary and Analytics APIs

Status: Draft (spec-driven; implementation gated by approvals)
Owner: Backend Team
Target: backend-2 (NestJS)

## Overview
Implement usage summary and analytics endpoints to mirror Spring Boot’s `UsageController` and `AnalyticsController` for time-bound usage stats, daily usage, and session listings.

## Spring Reference
- Usage summary and sessions: `backend/turing/src/main/java/com/ashelabs/turing/controller/UsageController.java`
- Analytics reporting: `backend/turing/src/main/java/com/ashelabs/turing/controller/AnalyticsController.java`

## Proposed Controllers (NestJS)

### UsageController (new): `/api/usage`
- GET `/summary/:userId?startDate=yyyy-mm-dd&endDate=yyyy-mm-dd`
  - Returns aggregated usage summary for period
  - Parity with Spring’s date parsing defaults (start = now-7d, end = now)
- GET `/sessions/:userId?roomId=...&limit=50`
  - Returns session list filtered by user and optional room

### AnalyticsController (new): `/api/analytics`
- GET `/user/:userId/usage?startDate=yyyy-mm-dd&endDate=yyyy-mm-dd&roomId=...`
  - Returns usage stats map, today usage seconds, and sessions list for period
  - Mirrors combination of repository aggregations from Spring

## Aggregations & Data
- UsageSession fields leveraged: duration, energy_kwh, cost, usage; status for active/completed
- Provide helper methods in `UsageSessionService` to:
  - `getUsageStatistics(userId, start, end)`
  - `calculateDailyUsage(userId, LocalDate)`
  - `findSessionsByDateRange(userId, start, end)` and `findSessionsByRoomAndDateRange(roomId, start, end)`

## Responses
- Summary: `{ userId, period: { start, end }, totals: { durationSeconds, energyKwh, cost }, sessionsCount, generatedAt }`
- Analytics (parity with Spring map): `{ userId, period, roomId, statistics, todayUsageSeconds, sessions, generatedAt }`

## Error Handling
- 400 on invalid date formats
- 401/403 on authz

## Test Plan
- Unit: date parsing defaults; aggregation math; filtering by room
- E2E: compare against Spring sample datasets for parity

## Dependencies & Sequencing
- Depends on: `UsageSessionService` (present) with added aggregation methods
- Should follow completion of `quota-crud-and-overrides` and `quota-violations` to include those data points where needed
- Order: after quota features are stable
- See full graph and order: `docs/specs/complete-refactor/SEQUENCING.md`

## Validation Workflow (AGENTS.md)
1) `pnpm build`
2) `pnpm test`
3) `pnpm lint`
4) STOP and request guidance on failure
