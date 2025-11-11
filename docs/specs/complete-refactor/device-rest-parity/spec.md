# Spec: Device REST Parity Adapters (Optional)

Status: Draft (optional; spec-driven; gated by approvals)
Owner: Backend Team
Target: backend-2 (NestJS)

## Overview
Spring Boot exposes granular device control endpoints (temperature/mode/fan/power/vane/wide-vane). NestJS consolidates aircon control under `POST /api/devices/:id/aircon`. If clients depend on granular paths, add thin REST adapters that forward to existing service logic.

## Spring Reference
- `backend/turing/src/main/java/com/ashelabs/turing/api/device/DeviceController.java`
  - POST /api/devices/command/temperature
  - POST /api/devices/command/mode
  - POST /api/devices/command/fan
  - POST /api/devices/command/power
  - POST /api/devices/command/vane
  - POST /api/devices/command/wide-vane

## Proposed Endpoints (NestJS, optional)
Base: `/api/devices/command`
- POST `/temperature` → body `{ deviceIdentifier: string, temperature: number }`
- POST `/mode` → `{ deviceIdentifier, mode }`
- POST `/fan` → `{ deviceIdentifier, fanSpeed }`
- POST `/power` → `{ deviceIdentifier, power }`
- POST `/vane` → `{ deviceIdentifier, vanePosition }`
- POST `/wide-vane` → `{ deviceIdentifier, wideVanePosition }`

All endpoints delegate to `DevicesService.controlAircon` with converted `AirconControlDto`.

## Test Plan
- Contract tests to confirm forwarding correctness and MQTT publish

## Dependencies & Sequencing
- Depends on: `DevicesService` (present)
- Optional: implement only if client compatibility requires granular endpoints
- Order: last, after core quota/household/analytics work
- See full graph and order: `docs/specs/complete-refactor/SEQUENCING.md`

## Validation Workflow (AGENTS.md)
1) `pnpm build`
2) `pnpm test`
3) `pnpm lint`
