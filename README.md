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
- To return user to front-end after social login, call start endpoints with `redirect_uri`:
	- Example: `GET /auth/google?redirect_uri=https://financial.pscodium.dev/callback`
	- Callback redirects to your app with `?token=<JWT>&code=<PROVIDER_CODE>`
