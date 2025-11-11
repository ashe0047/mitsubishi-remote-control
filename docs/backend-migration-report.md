# Backend Migration Report: Spring Boot (backend/) → NestJS (backend-2/)

Date: 2025-11-02

This report inventories the Spring Boot features in `backend/turing` and assesses migration status to NestJS in `backend-2/`. It highlights what’s completed, partially migrated, or missing, and outlines actionable gaps and next steps.

## Executive Summary

- Core platform pieces are present in NestJS: authentication, users, rooms, devices (incl. MQTT), WebSocket gateways (airconditioner, quota), TypeORM entities, Redis, MQTT, and health checks.
- Quota domain is partially migrated: validation/calculation/session services exist; REST CRUD and override workflows are stubs; some strategy implementations are TODO.
- Household/Family management and invitations exist at the entity/service level but lack controllers (no public API yet).
- Usage analytics and reporting endpoints from Spring Boot are not yet implemented in NestJS.
- Error handling is centralized in NestJS, improving on Spring’s scattered handling.

## Feature Matrix

| Feature | Spring Boot (backend/turing) | NestJS (backend-2) | Status |
|---|---|---|---|
| Authentication & JWT | `AuthController` with JWT context | `api/auth` controller, `TokensService`, JWT guards | Complete |
| Users (profile, password) | `UserController` | `api/users` | Complete |
| Households/Family & Invitations | `FamilyController` | Entities + `HouseholdsService` only; no controller | Partial (API missing) |
| Rooms (CRUD + lookup) | `RoomController` | `api/rooms` | Complete |
| Devices (register, query, control) | `DeviceController`, discovery | `api/devices`, `DevicesService`, discovery | Mostly complete (API shape differs) |
| MQTT integration | `MqttService`, reactive services | `shared/mqtt/*` with health | Complete |
| WebSockets: Aircon | `AirConditionerWebSocketHandler` | `devices/airconditioner.gateway.ts` | Complete (minor TODOs) |
| WebSockets: Quota | `QuotaWebSocketHandler` | `quotas/quota.gateway.ts` | Complete (backend services wired) |
| Quotas: Validation/Calc | `QuotaValidationService` | `quota-validation.service.ts`, `quota-calculation-engine.service.ts` | Complete (strategies have TODOs) |
| Quotas: Usage Sessions | `UsageController` (sessions) | `quotas/usage-session.controller.ts` | Partial (sessions present; summary endpoints missing) |
| Quotas: CRUD | `QuotaController` | `quotas/controllers/quota.controller.ts` | Partial (CRUD methods are TODO) |
| Quotas: Overrides | `QuotaController` override ops | `quotas/controllers/quota-override.controller.ts` | Partial (controller stubs; no service) |
| Quotas: Violations | `QuotaViolationRepository` | `quota-violation.entity.ts` | Partial (no controller/service) |
| Usage Analytics/Reports | `AnalyticsController`, `UsageController` summary | Missing | Missing |
| Health checks | Terminus indicators | `health/health.controller.ts` + indicators | Complete |
| Error handling | Controller-level | Centralized `shared/errors/*` + global filter | Complete |

## Spring Boot Inventory (selected highlights)

- REST Controllers
  - Rooms: `backend/turing/src/main/java/com/ashelabs/turing/controller/RoomController.java`
  - Devices: `backend/turing/src/main/java/com/ashelabs/turing/api/device/DeviceController.java`
  - Auth: `backend/turing/src/main/java/com/ashelabs/turing/controller/AuthController.java`
  - Users: `backend/turing/src/main/java/com/ashelabs/turing/controller/UserController.java`
  - Family/Household: `backend/turing/src/main/java/com/ashelabs/turing/controller/FamilyController.java`
  - Quotas: `backend/turing/src/main/java/com/ashelabs/turing/controller/QuotaController.java`
  - Usage: `backend/turing/src/main/java/com/ashelabs/turing/controller/UsageController.java`
  - Analytics: `backend/turing/src/main/java/com/ashelabs/turing/controller/AnalyticsController.java`
- WebSockets
  - Aircon: `backend/turing/src/main/java/com/ashelabs/turing/websocket/AirConditionerWebSocketHandler.java`
  - Quota: `backend/turing/src/main/java/com/ashelabs/turing/websocket/QuotaWebSocketHandler.java`
- Services & Infra
  - MQTT: `backend/turing/src/main/java/com/ashelabs/turing/service/MqttService.java`
  - Reactive device control: `ReactiveAirConService`, `ReactiveMqttService`
  - Quota validation, usage tracking, notifications
  - Repositories for users, rooms, devices, quotas, usage, invitations, violations

## NestJS Inventory and Mapping

### Auth
- Controllers/Services
  - `backend-2/src/auth/auth.controller.ts`
  - `backend-2/src/auth/auth.service.ts`
  - `backend-2/src/auth/tokens/tokens.service.ts`
  - Guards: `backend-2/src/auth/guards/jwt-access.guard.ts`, `backend-2/src/auth/guards/jwt-refresh.guard.ts`
- Status: Complete; endpoints mirror Spring (register, login, me, refresh, logout) with Redis-backed token blacklist/rotation.

### Users
- Controllers/Services
  - `backend-2/src/users/users.controller.ts`
  - `backend-2/src/users/users.service.ts`
- Status: Complete for profile retrieval/update and password change.

### Households/Family
- Entities/Services (no controller)
  - `backend-2/src/households/entities/household.entity.ts`
  - `backend-2/src/households/entities/family-invitation.entity.ts`
  - `backend-2/src/households/households.service.ts`
- Status: Partial. Spring Boot’s `FamilyController` features (inviting, accepting, listing members) are not exposed via NestJS controllers yet.

### Rooms
- Controllers/Services
  - `backend-2/src/rooms/rooms.controller.ts`
  - `backend-2/src/rooms/rooms.service.ts`
- Status: Complete. CRUD, identifier lookup, integrated device summaries.

### Devices & MQTT
- Controllers/Services
  - `backend-2/src/devices/devices.controller.ts`
  - `backend-2/src/devices/devices.service.ts`
  - MQTT: `backend-2/src/shared/mqtt/mqtt.service.ts`
- Differences: Spring exposes per-command REST endpoints (temp/mode/fan/power/etc.). NestJS consolidates aircon commands under `POST /api/devices/:id/aircon` via `AirconControlDto`.
- Status: Mostly complete. Behavior parity via MQTT likely preserved; REST shape differs.

### WebSockets
- Base and Gateways
  - Base: `backend-2/src/shared/websockets/base.gateway.ts`
  - Aircon: `backend-2/src/devices/airconditioner.gateway.ts`
  - Quota: `backend-2/src/quotas/quota.gateway.ts`
  - Redis Adapter: `backend-2/src/shared/websockets/services/redis-adapter.service.ts`
- Status: Complete. Aircon gateway notes minor TODOs on timing/validation; Quota gateway integrates validation/cache/session services.

### Quotas Domain
- Entities
  - `backend-2/src/quotas/entities/quota.entity.ts`
  - `backend-2/src/quotas/entities/usage-session.entity.ts`
  - `backend-2/src/quotas/entities/quota-override.entity.ts`
  - `backend-2/src/quotas/entities/quota-violation.entity.ts`
- Services
  - `backend-2/src/quotas/services/quota-validation.service.ts`
  - `backend-2/src/quotas/services/quota-calculation-engine.service.ts`
  - `backend-2/src/quotas/services/usage-session.service.ts`
  - Cache: `backend-2/src/quotas/services/quota-cache.service.ts`
- Controllers
  - Validation & utils: `backend-2/src/quotas/controllers/quota.controller.ts` (CRUD are TODO)
  - Usage sessions: `backend-2/src/quotas/controllers/usage-session.controller.ts`
  - Overrides: `backend-2/src/quotas/controllers/quota-override.controller.ts` (stubs)
- Strategies (some TODOs)
  - `time-based.strategy.ts`, `energy-based.strategy.ts`, `cost-based.strategy.ts`, `usage-based.strategy.ts`
- Status: Partial. Core validation/engine/sessions exist; CRUD, overrides, and some strategies need implementation.

### Usage & Analytics
- Spring Boot
  - Usage summary and history: `UsageController.java`
  - Analytics reports: `AnalyticsController.java`
- NestJS
  - Sessions controller covers CRUD-like operations for sessions: `usage-session.controller.ts`
  - No usage summary or analytics controller present.
- Status: Missing key reporting/summarization endpoints.

### Health & Observability
- NestJS
  - `backend-2/src/health/health.controller.ts`
  - Indicators: `shared/database/database.health.ts`, `shared/redis/redis.health.ts`, `shared/mqtt/mqtt.health.ts`
- Status: Complete.

### Error Handling
- NestJS
  - Centralized module + global filter: `backend-2/src/shared/errors/errors.module.ts`
  - Utilities and strategies under `shared/errors/*`
- Status: Complete; more structured than Spring implementation.

## Identified Gaps and Recommendations

1) Households/Family API
- Gap: No NestJS controllers for invitations/membership management.
- Evidence: Entities and service only; no `households.controller.ts`.
- Recommendation: Add `api/households` controller with endpoints:
  - Invite member, accept/decline, list members/invitations, revoke.
  - Map to `FamilyInvitation` and `HouseholdsService` logic.

2) Quota CRUD & Overrides
- Gaps:
  - `quotas/controllers/quota.controller.ts` has TODOs for all CRUD routes.
  - `quotas/controllers/quota-override.controller.ts` is a placeholder without service.
  - No dedicated service for overrides/violations.
- Recommendation:
  - Implement `QuotaService` for CRUD; wire TypeORM repositories for `Quota` and associated aggregates.
  - Implement `QuotaOverrideService` for request/approve/reject/cancel flows and state transitions.
  - Add `QuotaViolationService` for recording and querying violations.
  - Ensure cache invalidation hooks in `QuotaCacheService` on write ops.

3) Quota Calculation Strategies
- Gaps: `energy-based.strategy.ts`, `cost-based.strategy.ts`, and parts of `time-based.strategy.ts` contain TODOs.
- Recommendation: Port logic from Spring equivalents (if present) or align with product requirements; ensure unit tests.

4) Usage Summary & Analytics
- Gaps: No `api/usage` summary/reporting endpoints; `AnalyticsController` missing.
- Recommendation: Add `UsageController` in NestJS with endpoints mirroring Spring:
  - `GET /api/usage/summary/:userId?startDate&endDate`
  - `GET /api/usage/sessions/:userId?roomId&limit`
  - Implement aggregation queries in `UsageSessionService` or a new analytics service.

5) Devices REST Parity (optional)
- Gap: Spring exposes granular device commands; NestJS consolidates via `POST /api/devices/:id/aircon`.
- Recommendation: Maintain consolidated endpoint if frontend supports it; otherwise, add thin REST adapters for parity.

6) WebSocket Minor TODOs
- Gaps: Aircon gateway has TODOs for processing timing and validation depth.
- Recommendation: Add timing metrics and room/device validation hooks.

## Endpoint Mapping Overview

Note: NestJS namespaces follow `/api/*` for REST and `/ws/*` for Socket.IO, consistent with frontend expectations.

- Auth
  - Spring: `/api/auth/*` → Nest: `/api/auth/*` (register, login, refresh, logout, me)
- Users
  - Spring: `/api/users/*` → Nest: `/api/users/*` (me, update, change password)
- Rooms
  - Spring: `/api/rooms/*` → Nest: `/api/rooms/*` (CRUD, by-identifier, device summaries)
- Devices
  - Spring: `/api/devices/*` → Nest: `/api/devices/*` (register/list/get/delete; consolidated control endpoint)
- Quotas
  - Spring: `/api/quotas/*` (CRUD, status, override) → Nest: `/api/quotas/*` (validation/cache/health only; CRUD/override TODO)
- Usage
  - Spring: `/api/usage/*` (summary/sessions) → Nest: `/usage-sessions/*` (sessions only; summary missing)
- Analytics
  - Spring: `/api/analytics/*` → Nest: Missing
- WebSockets
  - Aircon: Spring handler → Nest Gateway at `/ws/airconditioner`
  - Quota: Spring handler → Nest Gateway at `/ws/quota`

## Data & Infra Parity

- Entities: Users, Rooms, Devices, DeviceStatusHistory, Household, FamilyInvitation, Quota, Override, Violation, UsageSession, UserRoomAssignment are present in NestJS.
- Database: TypeORM configured via `backend-2/src/database/data-source.ts`; migrations scaffolded but not present.
- Redis: Module and health indicator present; used for tokens and quota caching.
- MQTT: Service and health indicator present; used by devices and gateways.

## Priority Next Steps

1. Implement Quota CRUD + Override Services and wire controller methods (update cache, add tests).
2. Add Households/Family controller to expose invitations and membership management.
3. Implement Usage summary and Analytics controllers based on Spring contracts.
4. Complete quota strategy TODOs with tests for time/energy/cost calculations.
5. Add validation/timing metrics in Aircon gateway; ensure role/room/device access checks.
6. Consider parity adapters for device command REST if clients depend on Spring endpoints.

## Noteworthy Code References (NestJS)

- Auth: `backend-2/src/auth/auth.controller.ts`, `backend-2/src/auth/auth.service.ts`
- Users: `backend-2/src/users/users.controller.ts`
- Rooms: `backend-2/src/rooms/rooms.controller.ts`
- Devices: `backend-2/src/devices/devices.controller.ts`
- Quotas: `backend-2/src/quotas/controllers/quota.controller.ts`
- Usage Sessions: `backend-2/src/quotas/controllers/usage-session.controller.ts`
- Quota Overrides: `backend-2/src/quotas/controllers/quota-override.controller.ts`
- WebSockets (Aircon): `backend-2/src/devices/airconditioner.gateway.ts`
- WebSockets (Quota): `backend-2/src/quotas/quota.gateway.ts`
- Health: `backend-2/src/health/health.controller.ts`
- MQTT: `backend-2/src/shared/mqtt/mqtt.service.ts`
- Redis Adapter: `backend-2/src/shared/websockets/services/redis-adapter.service.ts`
- Error Handling: `backend-2/src/shared/errors/errors.module.ts`

---

Prepared by: Migration Audit Automation
