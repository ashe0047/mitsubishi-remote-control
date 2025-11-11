# Design: Quota Calculation Strategies

## Algorithms
- Time-based: sum session durations overlapping current period; remaining = allowed - used
- Energy-based: sum `energy_kwh` in period; remaining = allowed - used
- Cost-based: sum `cost` if available, else derive from energy * rate; remaining = allowed - used
- Usage-based: sum `usage` counter; remaining = allowed - used

## Period Window
- Compute start/end based on `period` and `resetTime`
- Handle timezone using server-configured default

## Integration
- Strategy selection by `quota.quotaType`
- Use `UsageSessionService` aggregations for performance; fallback to DB if cache miss

## Edge Cases
- No sessions → used=0
- Negative or NaN inputs → coerce to 0 and log warning
- Overrides: when active, either bypass BLOCK (emergency/unlock) or add to limit (add-time)

## Sequencing & Approvals
- Phase 1: Define exact inputs/outputs for strategy interface (no changes to public types)
- Phase 2: Implement time-based (baseline), then energy-based, cost-based, usage-based
- Phase 3: Expand tests with shared fixtures to validate period windows and overrides
