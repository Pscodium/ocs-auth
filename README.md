# OCS Auth Service

Production-ready OAuth2-like authentication service built with Fastify, Prisma, and PostgreSQL.

## Requirements
- Node.js 20+
- PostgreSQL
- Redis

## Setup
1) Create a database and update `.env` from `.env.example`.
	- Add `REDIS_URL` (example: `redis://localhost:6379`).
	- Add OAuth provider settings:
		- `BASE_URL`
		- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
		- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
		- `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`
2) Install dependencies: `npm install`
3) Generate Prisma client: `npm run prisma:generate`
4) Run migrations: `npx prisma migrate dev`
5) Start dev server: `npm run dev`

## Production
- Build: `npm run build`
- Start: `npm run start`

## Notes
- Create OAuth clients in the database before use.
- Migration provisions `social_oauth` client used by social login JWT issuance.
- JWT keys must be valid RSA PEM values.
- Social OAuth2 endpoints:
	- `GET /auth/google`
	- `GET /auth/google/callback`
	- `GET /auth/github`
	- `GET /auth/github/callback`
	- `GET /auth/microsoft`
	- `GET /auth/microsoft/callback`
- To return user to front-end after social login, call start endpoints with PKCE context:
	- Example: `GET /auth/google?redirect_uri=https://financial.pscodium.dev/callback&client_id=electron-app&code_challenge=<PKCE_CHALLENGE>&code_challenge_method=S256`
	- Callback redirects to your app with `?code=<INTERNAL_AUTH_CODE>`
	- Exchange `code` at `POST /auth/token` with `grant_type=authorization_code`, `client_id`, `redirect_uri`, and `code_verifier`.
- `POST /auth/token` sets `refresh_token` (`path=/auth`) and `access_token` (`path=/`) in `HttpOnly` cookies.
- For auth/api split across subdomains, set `COOKIE_DOMAIN` (example: `.pscodium.dev`) so cookies can be sent to sibling subdomains.
- Cookie policy is configurable via `COOKIE_SAME_SITE` (`strict` | `lax` | `none`).
- For `grant_type=refresh_token`, you can omit `refresh_token` in body and use the cookie automatically.

## Project Structure
- `src/modules/*/presentation`: HTTP layer (routes, controllers, request schemas).
- `src/modules/*/application`: application services/use-case orchestration.
- `src/modules/*/infrastructure`: data access implementations (repositories).
- `src/modules/*/domain`: module-specific types/contracts.
- `src/shared`: cross-cutting concerns grouped by concern:
	- `security` (crypto, jwt, validators)
	- `persistence` (prisma)
	- `cache` (redis)
	- `http` (auth context)
	- `observability` (logger)
	- `errors` (app error base class)
