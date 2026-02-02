# Restorae Backend (NestJS)

## Local development

1. Start Postgres + Redis:
   - `docker compose up -d`
2. Create env:
   - Copy `.env.example` → `.env` and fill values as needed.
3. Install + run:
   - `npm ci`
   - `npm run prisma:generate`
   - `npm run start:dev`

API runs on `http://localhost:3001` with prefix `/api/v1`.

## Useful commands

- Lint: `npm run lint` (or `npm run lint:fix`)
- Tests: `npm test`
- Build: `npm run build`
- Migrations: `npm run prisma:migrate`
- Seed: `npm run db:seed` (set `ADMIN_SEED_PASSWORD` for non-dev)

## Production notes

- Do not commit real secrets: use `.env.prod.example` → `.env.prod` on the server.
- Docker production entry runs `prisma migrate deploy` before starting the app (see `docker-compose.prod.yml`).
- Swagger is enabled only when `NODE_ENV !== "production"`.
