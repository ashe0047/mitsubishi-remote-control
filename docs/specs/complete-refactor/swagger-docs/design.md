# Design: OpenAPI (Swagger) Documentation

## Initialization
- Add Swagger setup in `main.ts` using `DocumentBuilder` and `SwaggerModule`.
- Title: Mitsubishi AC Control Platform
- Description: NestJS APIs for authentication, rooms, devices, quotas, analytics
- Version: read from env (`APP_VERSION`) or fallback to `1.0.0`.
- Security: `.addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header', name: 'Authorization' }, 'bearer')`.

## Serving
- Setup path: `/docs`
- JSON endpoint `/docs-json` is provided by Nest automatically.
- Enable only when `process.env.SWAGGER_ENABLED === 'true'` OR `NODE_ENV !== 'production'`.

## Extensibility
- Controllers can add `@ApiTags('rooms')`, `@ApiBearerAuth('bearer')`, etc., incrementally.
- Multi-doc support (future): can create separate documents per area if needed.

## Risks
- Missing dependencies at runtime; document install instructions for pnpm.
- Exposing docs in production unintentionally—use env guard.
