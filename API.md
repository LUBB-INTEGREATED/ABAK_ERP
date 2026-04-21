# ABAK ERP API Reference

Everything the frontend or a 3rd-party client needs to know about the
Nest.js API.

- Base URL (local): `http://localhost:3001/api/v1`
- Interactive docs (Swagger): `http://localhost:3001/api/docs`
- OpenAPI JSON: `http://localhost:3001/api/docs-json`

## Running the API

```bash
# 1. Postgres
pnpm db:up

# 2. Migrate & seed
pnpm prisma:migrate
pnpm prisma:seed

# 3. Serve
pnpm nx serve api
```

Environment variables are documented in `.env.example` at the repo
root. The two that matter most:

| Variable       | Required | Purpose                                    |
| -------------- | -------- | ------------------------------------------ |
| `DATABASE_URL` | yes      | Prisma connection string                   |
| `JWT_SECRET`   | yes      | Signs access + refresh tokens (≥ 32 chars) |

## Authentication

All routes except the ones below are protected by `JwtAuthGuard` and
require a bearer token.

### Public endpoints

| Method | Path             | Description                  |
| ------ | ---------------- | ---------------------------- |
| POST   | `/auth/register` | Create a user + issue tokens |
| POST   | `/auth/login`    | Exchange credentials         |
| POST   | `/auth/refresh`  | Rotate the token pair        |

### Adding the header

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

The browser client handles this automatically via an axios interceptor
(`packages/web/src/lib/api-client.ts`).

### Token lifecycle

| Token         | TTL    | Stored in           |
| ------------- | ------ | ------------------- |
| access token  | 15 min | memory (Zustand)    |
| refresh token | 7 days | `refresh_tokens` DB |

On 401 the client retries once after calling `POST /auth/refresh`. A
successful refresh returns a brand-new pair and invalidates the old
refresh token in the database.

## Response envelope

Every JSON response follows:

```json
{
  "success": true,
  "data": { ... },
  "message": "optional human string"
}
```

Errors use standard HTTP status codes + a body like:

```json
{
  "statusCode": 400,
  "message": "email must be an email",
  "error": "Bad Request"
}
```

Validation errors return an array of messages so the frontend can show
per-field feedback.

## Common headers

| Header          | Notes                                       |
| --------------- | ------------------------------------------- |
| `Authorization` | `Bearer <jwt>` for every protected route    |
| `Content-Type`  | `application/json` on POST/PUT/PATCH        |
| `X-Request-Id`  | Optional client-supplied ID; echoed in logs |

## Pagination

List endpoints accept:

```
GET /resource?page=1&limit=20&sort=createdAt&order=desc
```

The response envelope adds a `pagination` block:

```json
{
  "data": [...],
  "pagination": { "page": 1, "limit": 20, "total": 142, "pages": 8 }
}
```

## Swagger

Swagger is powered by `@nestjs/swagger`. Controllers tag themselves
with `@ApiTags()` and endpoints describe request/response shapes with
`@ApiOperation()`, `@ApiProperty()`, etc. The Swagger UI at
`/api/docs` exposes a "Try it out" button per endpoint — paste an
access token into the Authorize dialog once and every call in the
session is authenticated.

## Curl quick start

```bash
# Register + capture the token
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"me@abak.com","password":"Password123!","firstName":"Dev"}' \
  | jq -r '.accessToken')

# Call a protected endpoint
curl http://localhost:3001/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

## Adding a new endpoint

1. Generate a module: `pnpm nx g @nx/nest:module modules/<name> --project=api`
2. Add a controller + service + DTOs; import the module into
   `packages/api/src/app/app.module.ts`.
3. Default routes are protected. Mark anything public with
   `@Public()` (from `modules/auth/decorators/public.decorator.ts`).
4. Add Swagger decorators so the OpenAPI spec stays accurate.
5. Update `API.md` if the new endpoint changes public contracts.
