# Design: Device REST Parity Adapters

## Architecture
- New `DeviceCommandsController` under `/api/devices/command`
- Delegates to `DevicesService` to reuse MQTT publishing logic

## Mapping
- Map each granular command payload to `AirconControlDto` shape used by consolidated endpoint
- Resolve `deviceIdentifier` → internal device id via service lookup when needed

## Authorization
- Use `JwtAccessGuard`; parent-only not required for commands if Spring did not enforce it (confirm). Keep consistent with existing devices controller.

## Sequencing & Approvals
- Gate A: Confirm business need for parity routes (front-end consumers)
- Phase 1: Controller scaffolding + DTOs
- Phase 2: Adapter logic mapping to `AirconControlDto`
- Phase 3: Tests ensuring idempotent forwarding and MQTT side-effects
