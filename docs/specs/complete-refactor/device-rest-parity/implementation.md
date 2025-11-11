# Implementation Plan: Device REST Parity

## Steps
1) Add `DeviceCommandsController` with per-command routes
2) Create DTOs mirroring Spring payloads; validate with class-validator
3) Forward to `DevicesService.controlAircon` with converted `AirconControlDto`
4) Tests: verify MQTT side-effects and mappings

## Acceptance Criteria
- Clients of Spring paths can call equivalent Nest routes with identical payloads

## Validation Workflow (AGENTS.md)
- Build: `pnpm build`
- Lint: `pnpm lint`
- Test: `pnpm test`
