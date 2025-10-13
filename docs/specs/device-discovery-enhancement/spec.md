# Device Discovery Enhancement Spec

## Background
- Current discovery endpoint (`DeviceDiscoveryController#getDiscoveredDevices`) proxies to `DeviceService#getDevicesByRoom`, which only surfaces persisted/registered devices.
- MQTT discovery flow (`MqttMessageSubscriber#triggerDeviceDiscovery`) emits broadcast WebSocket notifications without persisting or caching the discovery payloads.
- Frontend `useDeviceWebSocket` leaves the discovery subscription commented out, so no realtime discoveries reach the UI.
- `useDeviceDiscovery` expects selectors (`discoveredDevices`, `addDiscoveredDevice`, etc.) that are absent from `device-store`, preventing the hook from functioning.
- Discovery dialog currently queries REST for discoveries but receives the registered-device list, so end users see duplicates of what is already added instead of pending discoveries.

## Goals
- Return actual pending discoveries (devices seen on MQTT but not yet registered) from dedicated REST endpoints.
- Persist discovery metadata with a TTL to enable room-level filtering, dismissal, and registration workflows.
- Publish discovery events to both the persistence/cache and to WebSocket clients in a single coordinated flow.
- Expose device discovery state through the frontend store with clear selectors and actions for reacting to push events and REST fallbacks.
- Ensure all interactions follow clean code principles (SRP, ISP, DRY) and integrate naturally with existing services/stores.

## Non-Goals
- Redesign of the core device registration UI beyond necessary integration changes.
- Long-term persistence of discoveries across system restarts (short-lived cache acceptable).
- Broader MQTT topic restructuring or protocol changes.
- Refactoring unrelated device management APIs or stores.

## Solution Overview
Introduce an explicit discovery domain concept backed by an abstraction that can be satisfied by an in-memory cache (initial implementation) while supporting future persistence. Coordinate discovery flows via a new `DeviceDiscoveryService` that both stores discovery records and feeds WebSocket notifications. Update backend REST APIs to return discovery records and to register/dismiss them. Extend frontend state management and WebSocket integration to consume the new endpoints and message streams, enabling the discovery dialog to render actual pending devices.

## Architectural Changes

### Backend
- **Domain Model**: Create `DiscoveredDevice` record encapsulating identifier, optional room, device type, payload, metadata, and timestamps.
- **Repository Abstraction**: Define `DiscoveredDeviceRepository` interface supporting `save`, `findAll`, `findByRoomId`, `delete`, and automatic expiry semantics. Provide an initial in-memory implementation using `ConcurrentHashMap` + scheduler. Mark interface to allow alternative implementations (e.g., Redis) later (DIP compliance).
- **Service Layer**: Add `DeviceDiscoveryService` orchestrating repository access, de-duplication, TTL enforcement, and conversion to DTOs. Responsibilities include:
  - Recording discovery events (idempotent on device identifier).
  - Clearing discoveries (on registration/dismissal).
  - Fetching by room or globally.
  - Handing off to `DeviceService` for registration and removing discovery on success.
- **MQTT Integration**: Inject `DeviceDiscoveryService` into `MqttMessageSubscriber` and call `recordDiscovery(...)` before emitting WebSocket notifications. Ensure broadcast payload includes correlation fields (room, deviceIdentifier, metadata).
- **REST API**: Update `DeviceDiscoveryController` to delegate to `DeviceDiscoveryService`. Endpoints:
  - `GET /api/devices/discovery` → all pending discoveries.
  - `GET /api/devices/discovery/room/{roomId}` → pending for room.
  - `POST /api/devices/discovery/register` → register via discovery service (handles persistence removal and delegates to existing `DeviceService.registerDevice`).
  - `POST /api/devices/discovery/{deviceIdentifier}/dismiss` → remove discovery without registering.
  - Ensure DTO conversions live in `api.device.dto`.
- **Consistency Checks**: On registration, confirm device isn't already registered; log/handle race conditions gracefully.
- **Clean Code Alignment**: SRP by separating discovery service from device registration; DIP via repository interface; avoid duplication by reusing DTO/mappers.

### Frontend
- **Types**: Ensure `DiscoveredDevice` type in `@/types` includes identifier, label, discoveredAt, source metadata, and optional roomId/deviceType.
- **API Client**: Extend `device-api-client` with discovery endpoints for fetch, register, dismiss.
- **Store Enhancements** (`device-store`):
  - Add `discoveredDevices: Record<string, DiscoveredDevice>` or array plus selectors (e.g., `getDiscoveries`, `getDiscoveriesByRoom`).
  - Actions: `hydrateDiscoveries`, `addDiscoveredDevice`, `dismissDiscovery`, `clearDiscoveries`, `registerDiscoveredDevice`.
  - Ensure derived selectors memoize stable references (use `Object.values` inside selectors or maintain arrays).
  - Maintain error/loading flags separately for discovery operations.
- **WebSocket Hook**: Enable `useDeviceWebSocket` discovery subscription. When a discovery arrives, call `addDiscoveredDevice`. Consider deduping using identifier.
- **Discovery Hook** (`useDeviceDiscovery`): Update to use `useDeviceStore` directly (no undefined `deviceStore` export) and rely on new selectors/actions. Support fallback fetch (REST) on mount if required.
- **UI Integration**: Refine `DiscoverDevicesDialog` to source data from the store and respond to dismissal/registration actions. After successful registration, remove discovery and optionally refresh registered device list.
- **Clean Code Alignment**: Hooks focused (ISP), store methods cohesive, selectors specific (Zustand guidelines), avoid logging noise once stabilized.

## Data Flow
1. MQTT message received for unknown identifier.
2. `MqttMessageSubscriber` invokes `DeviceDiscoveryService.recordDiscovery`, storing record and retrieving DTO.
3. Service publishes discovery DTO to WebSocket broadcaster.
4. Frontend WebSocket subscription receives DTO → `addDiscoveredDevice`.
5. User opens discovery dialog; data sourced from store (with GET fallback if needed).
6. On register:
   - Store invokes API client `registerDiscoveredDevice`.
   - Backend registers device via `DeviceService`, removes discovery.
   - Store updates registered device list (existing `fetchDevices` or immediate update) and removes discovery entry.
7. On dismiss:
   - Store calls dismiss API → backend removes discovery → store removes local entry.

## Risks & Mitigations
- **Duplicate Discoveries**: Use repository upsert keyed by device identifier; include last seen timestamp for UI sorting.
- **Race with Manual Registration**: On registration attempt, backend re-validates existing devices before creating new entry; on failure (device already registered) still clears discovery to prevent loops.
- **Memory Growth**: TTL eviction and size limits within repository mitigate unbounded growth.
- **Backward Compatibility**: Existing `DeviceService`/registration remains unchanged; new endpoints additive.

## Testing Strategy
- **Backend**
  - Unit tests for `DeviceDiscoveryService` covering record, fetch, register, dismiss, TTL expiry.
  - WebFlux controller tests for new endpoints (happy path + error scenarios).
  - Integration test ensuring MQTT subscriber records discovery when `DeviceRepository.findByDeviceIdentifier` misses (can simulate via service layer).
- **Frontend**
  - Store tests verifying actions mutate discovery state correctly.
  - Hook tests for `useDeviceDiscovery` verifying selectors and actions.
  - WebSocket adapter test (mock stream) to ensure incoming messages call `addDiscoveredDevice`.
  - Component test for `DiscoverDevicesDialog` verifying rendering of discoveries and invocation of actions.
- **E2E (optional/ future)**: Scenario covering discovery broadcast → UI registration.

## Acceptance Criteria
- `GET /api/devices/discovery/room/{roomId}` returns pending discoveries created via MQTT, not registered devices.
- Discovery WebSocket events result in UI updates without manual refresh.
- Discovery entries can be dismissed or registered from the UI, and registered devices appear in device lists.
- No infinite loops or broad store subscriptions; selectors remain specific per Zustand best practices.
