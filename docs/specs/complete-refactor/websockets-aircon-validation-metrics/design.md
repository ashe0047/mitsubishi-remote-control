# Design: Aircon WebSocket Validation & Metrics

## Validation
- On connect: extract `roomId`, `familyMemberId`; verify JWT user has access to room
- On message: verify `deviceId` exists in room when applicable

## Metrics
- For each command handler, record start time and compute `processingTime` in ms; include in response payloads

## Logging
- Add context: `{ socketId, userId, roomId, deviceId?, command }`
- Use `ErrorHandlerService` for safe error extraction

## Sequencing & Approvals
- Gate A: Confirm added constructor deps and public types do not break API
- Phase 1: Wire validation (connect + per-command)
- Phase 2: Add timing fields and instrumentation
- Phase 3: Tests
