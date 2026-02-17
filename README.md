# OCS Auth Service

Production-ready OAuth2-like authentication service built with Fastify, Prisma, and PostgreSQL.

## Requirements
- Node.js 20+
- PostgreSQL
- Redis

## Setup
1) Create a database and update `.env` from `.env.example`.
	- Add `REDIS_URL` (example: `redis://localhost:6379`).
2) Install dependencies: `npm install`
3) Generate Prisma client: `npm run prisma:generate`
4) Run migrations: `npx prisma migrate dev`
5) Start dev server: `npm run dev`

## Production
- Build: `npm run build`
- Start: `npm run start`

## Notes
- Create OAuth clients in the database before use.
- JWT keys must be valid RSA PEM values.
