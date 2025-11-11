# Error Handling Refactor Plan (HTTP + WebSocket)

This document captures the agreed consolidation plan for error handling across HTTP and WebSocket layers, plus the mapper work we’ll implement next. It reflects the current codebase state and the minimal-risk path forward.

## Objectives

- Single canonical error taxonomy (codes/categories) with transport-specific response DTOs.
- Consistent, centralized error formatting for HTTP and WebSocket.
- Keep validation and routing concerns separated (pipes/strategies) and avoid ad-hoc error shaping.

## Current State (after recent changes)

- WebSocket
  - Transport DTOs: `WsErrorResponse` (replaces the previously ambiguous `ErrorResponse`).
  - Gateways/guards/services updated to use `WsErrorResponse`.
  - Validation: shared `MessageEnvelopePipe` (generic) + domain `DeviceEnvelopePipe`.
  - Centralized logging via `ErrorHandlerService`; performance/session handling in place.
- HTTP
  - Transport DTO renamed for clarity: `HttpErrorResponse` (was `ErrorResponse`).
  - Global exception filter exists: `TypeSafeErrorFilter` (strategy-based) with `HttpErrorStrategy`, `BusinessErrorStrategy`, `UnknownErrorStrategy`.
  - `ResponseFormatterService` already shapes consistent HTTP error envelopes.

## What We Will Add Next

### 1) Shared Error Mappers (non-breaking)
- Location: `shared/errors/utils/error-mappers.ts`
- Responsibilities:
  - `toWsErrorResponse(info: ErrorInfo, ctx?: Record<string, unknown>): WsErrorResponse`
  - `toHttpErrorEnvelope(info: ErrorInfo, req?: RequestLike): HttpErrorEnvelope`
- Rationale: DRY up guard/handler code, ensure uniform formatting, make future changes trivial.

### 2) Adopt Mappers Where Appropriate
- WebSocket
  - `websocket-auth.guard.ts`: replace inline construction of `WsErrorResponse` with `toWsErrorResponse(...)`.
  - `websocket-message-handler.service.ts`: use mapper in `createErrorResponse`/`createUnknownErrorResponse` to build `WsErrorResponse`.
- HTTP (optional, since ResponseFormatterService is already central)
  - Keep `HttpErrorStrategy` delegating to `ResponseFormatterService` (good). If useful, `ResponseFormatterService` can internally use `toHttpErrorEnvelope` for consistency.

### 3) Types: Make HTTP Envelope Types Explicit (non-breaking)
- Introduce clear types to reflect actual formatter output:
  - `HttpErrorBody`: `{ statusCode, message, error, timestamp, path?, requestId?, details?, businessCode? }`
  - `HttpErrorEnvelope`: `{ success: false, error: HttpErrorBody }`
- Annotate `ResponseFormatterService` return types with `HttpErrorEnvelope`.

## Step-by-Step Implementation Plan

1. Add mappers file
   - File: `backend-2/src/shared/errors/utils/error-mappers.ts`
   - Export two pure functions: `toWsErrorResponse`, `toHttpErrorEnvelope`.
   - Unit-testable, no side effects.

2. Update WS guard and message handler to use mappers
   - `websocket-auth.guard.ts`: swap inline object for `toWsErrorResponse` (keep existing context metadata).
   - `websocket-message-handler.service.ts`: build error responses via mapper.

3. Clarify HTTP formatter typing
   - Add `HttpErrorBody`, `HttpErrorEnvelope` to `shared/errors/types/error.types.ts` (or keep `HttpErrorResponse` as the envelope and add `HttpErrorBody`).
   - Update `ResponseFormatterService` return annotations to these types.

4. Validation & Lint
   - `pnpm exec tsc --noEmit` and `pnpm run lint` on touched files.
   - Ensure no barrel (`index.ts`) re-exports create naming collisions.

5. Tests (if/when present)
   - WS: adjust/confirm unit tests for guard/handler error paths to match mapper-based responses.
   - HTTP: tests for `HttpErrorStrategy`/`ResponseFormatterService` continue to pass; update type expectations if using stronger annotations.

## Impact Analysis

- Files to be added (new):
  - `backend-2/src/shared/errors/utils/error-mappers.ts`
- Files to be updated:
  - WS: `websocket-auth.guard.ts`, `websocket-message-handler.service.ts`
  - HTTP typing only: `shared/errors/types/error.types.ts` and `shared/errors/services/response-formatter.service.ts` (annotations)
- Not affected:
  - Business logic, strategies, filters flow remains intact.

## Rollback Plan

- If any regression occurs:
  - Revert usage of mappers in the guard/handler; original inline construction is straightforward to restore.
  - No DB schema or persistence changes are involved.

## Risks & Mitigations

- Risk: Type naming collisions or re-export ambiguity
  - Mitigation: Avoid barrels that re-export both HTTP and WS DTOs together; use explicit imports.
- Risk: Inconsistent payload fields in corners
  - Mitigation: Centralize in mappers and `ResponseFormatterService` only; eliminate hand-built responses.

## Reference: Current DTOs & Shapes

- WebSocket: `WsErrorResponse` (in `websocket-messages.interface.ts`)
- HTTP: `ResponseFormatterService` returns `{ success: false, error: HttpErrorBody }` envelope

## Execution Order

1) Add mappers (no call sites updated yet) → compile.
2) Switch WS guard/handler to mapper → compile and lint.
3) Strengthen HTTP formatter typing → compile.
4) Optional: add/adjust tests.

---

Prepared by: Codex CLI (refactor plan)
Date: 2025-11-10
