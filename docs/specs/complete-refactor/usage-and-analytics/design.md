# Design: Usage Summary and Analytics APIs

## Architecture
- New `UsageController` and `AnalyticsController`
- Extend `UsageSessionService` with aggregation methods
- Type-safe DTOs for query params and responses

## Data Access
- Use TypeORM query builder for date-range filters on `UsageSession`
- Consider database indexes on `(user_id, started_at)`, `(room_id, started_at)`

## Behavior Parity
- Date parsing mirrors Spring: strings to LocalDate/LocalDateTime windows
- Defaults to last 7 days if not provided for summary

## Observability
- Include `generatedAt` timestamps
- Log ranges and counts

## Sequencing & Approvals
- Gate A: present controller/DTOs aggregation methods plan and wait for approval
- Phase 1: Service aggregations
- Phase 2: Controllers and DTOs
- Phase 3: Tests and parity checks
