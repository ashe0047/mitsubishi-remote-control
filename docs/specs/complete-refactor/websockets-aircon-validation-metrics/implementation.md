# Implementation Plan: Aircon WebSocket Validation & Metrics

## Steps
1) Inject `RoomsService` and `DevicesService` into `AirConditionerGateway`
2) Implement `validateRoomAccess()` to check membership
3) Implement device existence checks in handlers referencing `deviceId`
4) Add timing in each handler; populate `processingTime`
5) Tests: invalid room/device rejected; responses include timing

## Acceptance Criteria
- All command responses include `processingTime`
- Access violations throw `WsException` with safe messages

## Validation Workflow (AGENTS.md)
- Build: `pnpm build`
- Test: `pnpm test`
- Lint: `pnpm lint`
