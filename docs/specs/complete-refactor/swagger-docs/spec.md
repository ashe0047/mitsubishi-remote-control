# Spec: OpenAPI (Swagger) Documentation

Status: Draft (spec-driven)
Owner: Backend Team
Target: backend-2 (NestJS)

## Overview
Expose automatic API documentation using `@nestjs/swagger` so REST endpoints are discoverable and testable via Swagger UI, and the OpenAPI JSON is available for client generation.

## Goals
- Enable Swagger UI at `/docs` and JSON at `/docs-json`.
- Include JWT bearer auth in the spec for secured routes.
- Keep disabled in production by default; enable via env flag.

## Non-Goals
- Per-route annotations across all controllers (can be incremental using `@ApiTags`, `@ApiBearerAuth`, etc.).
- Generating client SDKs (future).

## Contract
- UI: `GET /docs` serves Swagger UI
- JSON: `GET /docs-json` returns OpenAPI JSON
- Security: bearer auth scheme named `Authorization` with HTTP `bearer` and format `JWT`.

## Dependencies
- Library: `@nestjs/swagger` (+ `swagger-ui-express`)
- Implementation location: `backend-2/src/main.ts`

## Validation
- Build and boot app; verify `/docs` and `/docs-json` respond when enabled.
- Ensure disabled in production unless `SWAGGER_ENABLED=true`.
