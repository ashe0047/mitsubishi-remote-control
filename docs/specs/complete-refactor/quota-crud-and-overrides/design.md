# Design: Quota CRUD, Status, and Overrides

## Architecture
- Controllers: `quotas/controllers/quota.controller.ts` (fill CRUD, status, override)
- Services: new `QuotaService`, new `QuotaOverrideService`; existing `QuotaValidationService`, `QuotaCacheService`, `UsageSessionService`
- Entities: `Quota`, `QuotaOverride`, `QuotaViolation`, `UsageSession`
- Guards: `JwtAccessGuard`, `RolesGuard` for parent-only routes

## DTOs & Shapes (Type-safe)
- CreateQuotaDto: `{ userId: string; roomId: string; quotaType: QuotaType; allowedAmount: number; warningThreshold?: number; period?: QuotaPeriod; resetTime?: string; description?: string }`
- UpdateQuotaDto: same as create (partial), server enforces immutable fields if any
- QuotaValidationDto: already present; ensure explicit union types for operation kinds
- OverrideRequestDto: `{ type: 'ADD_TIME'|'UNLOCK_DAY'|'EMERGENCY_OVERRIDE'; additionalSeconds?: number; reason?: string }`

## Mapping Spring → Nest
- `CreateQuotaRequest` → `CreateQuotaDto` one-to-one; `roomId` maps to `targetId` on entity
- `getQuotaStatus` returns `QuotaBalance` shape; mirror fields exactly for frontend compatibility

## Transactions & Consistency
- Use single-transaction writes for create/update to avoid race with concurrent validations
- After write, trigger cache invalidation synchronously; consider pub/sub for multi-node (future)

## Indexing & Queries
- Ensure indexes on `(user_id, target_id, period, status)` for fast active-quota lookups
- Consider partial index for `status=ACTIVE`

## Error Model
- Invalid inputs → 400; forbidden role → 403; missing resource → 404; unexpected → 500
- Use `ErrorsModule` to safely format unknown errors

## Telemetry
- Emit structured logs: `{ op, quotaId, userId, roomId, cacheInvalidated }`
- Add counters: quotas.created, quotas.updated, overrides.granted


## Service Responsibilities
- QuotaService
  - findActiveByUserAndRoom(userId, roomId, periodNow)
  - createOrUpdateQuota(userId, roomId, dto)
  - getAllByUser(userId)
  - getById/update/delete
  - cache invalidation hooks on writes
- QuotaOverrideService
  - request add-time / unlock-day / emergency
  - approve / reject / cancel transitions
  - integrate with sessions (extend remaining where applicable)

## Period Handling
- Determine active window from `period` and `resetTime`
- Daily: today between resetTime; Weekly/Monthly analogous
- Match Spring semantics for “active quota” per date

## Cache
- Preload user+room quotas; invalidate keys on create/update/delete/override

## WebSocket Integration
- On override grant/approval, emit events via `QuotaGateway` to subscribed clients

## Error Strategy
- Not found → 404; invalid override type → 400; forbidden for non-parent → 403
- Centralize formatting via `ErrorsModule`
