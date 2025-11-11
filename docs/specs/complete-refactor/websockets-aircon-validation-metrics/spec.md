# Spec: Aircon WebSocket Access Validation & Metrics

Status: Draft (spec-driven; implementation gated by approvals)
Owner: Backend Team
Target: backend-2 (NestJS)

## Overview
Close TODOs in `devices/airconditioner.gateway.ts` by adding: (1) room and device access validation, and (2) processing time metrics in responses, matching Spring’s emphasis on robust session handling in `AirConditionerWebSocketHandler`.

## Spring Reference
- `backend/turing/src/main/java/com/ashelabs/turing/websocket/AirConditionerWebSocketHandler.java` — validates roomId, manages session context, and routes commands.

## Requirements
- Validate on connect: `roomId` and `familyMemberId` present; user has access to room; device exists when referenced
- On each command:
  - Start timer → process → include `processingTime` in the command response payload (milliseconds)
  - If validation fails, send error frame with safe message via `ErrorHandlerService`
- Emit structured logs with correlation (socket id, roomId, userId)

## Implementation Notes
- Access Check: inject `RoomsService` and `DevicesService` to verify membership and device presence
- Metrics: use `performance.now()` or `Date.now()` for delta; store minimal overhead
- Keep DTO validation via `class-validator`; augment with business validation hooks

## Test Plan
- Unit: validation rejects missing/invalid roomId; unknown device errors
- Integration: measure processingTime > 0 for commands; success path includes field

## Dependencies & Sequencing
- Depends on: `RoomsService`, `DevicesService`, `ErrorHandlerService`
- Can be implemented independently; recommended after quota CRUD to cross-check room access with JWT roles
- Order: mid-sequence to unblock observability
- See full graph and order: `docs/specs/complete-refactor/SEQUENCING.md`

## Validation Workflow (AGENTS.md)
1) `pnpm build`
2) `pnpm test`
3) `pnpm lint`
