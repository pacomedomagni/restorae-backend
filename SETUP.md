# Restorae Backend - Setup Instructions

## Prerequisites

✅ Node.js 18+ installed
✅ Docker Desktop installed and running

## Setup Steps

### 1. Start Docker Desktop

Make sure Docker Desktop is running before proceeding.

### 2. Start Database

```bash
docker-compose up -d
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379

### 3. Run Database Migrations

```bash
npx prisma migrate dev --name init
```

This creates all database tables.

### 4. Seed Database (Optional)

```bash
npm run db:seed
```

This adds:
- Admin user (admin@restorae.com)
- Sample breathing exercises
- Sample grounding techniques
- Sample journal prompts
- FAQs
- System configuration

### 5. Start Development Server

```bash
npm run start:dev
```

Server starts on: http://localhost:3000
API Docs: http://localhost:3000/api

## Database Management

- **View database:** `npx prisma studio`
- **Create migration:** `npx prisma migrate dev --name your_migration_name`
- **Reset database:** `npx prisma migrate reset`

## Environment Variables

Update `.env` with your actual keys:
- `JWT_SECRET` - Change to a random string
- `REVENUECAT_API_KEY` - Get from RevenueCat dashboard
- `FIREBASE_*` - For push notifications
- `APPLE_*` / `GOOGLE_*` - For SSO (optional)

## Testing API

### Register Anonymous Device
```bash
curl -X POST http://localhost:3000/auth/anonymous \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "test-device-123"}'
```

### Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@restorae.com", "password": "your-password"}'
```

### Get Content
```bash
curl http://localhost:3000/content/breathing
```

## Troubleshooting

**Port 5432 already in use:**
- Stop any existing PostgreSQL instances
- Or change port in docker-compose.yml

**Prisma connection error:**
- Check Docker containers are running: `docker ps`
- Verify DATABASE_URL in .env

**Module not found errors:**
- Run `npm install` again
- Delete node_modules and reinstall
