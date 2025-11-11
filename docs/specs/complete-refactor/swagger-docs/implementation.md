## Implementation Plan: OpenAPI (Swagger)

### Steps
1) Edit `backend-2/src/main.ts` to:
   - Import `SwaggerModule` and `DocumentBuilder` from `@nestjs/swagger`.
   - Read `NODE_ENV` and `SWAGGER_ENABLED`.
   - When enabled, build config with title/description/version and `.addBearerAuth(...)`.
   - Create document and call `SwaggerModule.setup('docs', app, document)`.
2) Document install commands (to be run by developer):
   - `pnpm add -w -D @nestjs/swagger swagger-ui-express`
3) (Optional) Add `@ApiTags` and `@ApiBearerAuth('bearer')` to key controllers later.

### Acceptance Criteria
- `/docs` loads UI, `/docs-json` returns schema in non-production or when explicitly enabled.
- Spec includes bearer auth scheme.
