# Restorae Backend API

NestJS backend for the Restorae wellness app.

## Prerequisites

- Node.js 18+
- Docker & Docker Compose (for database)

## Quick Start

1. **Start the database**
   ```bash
   docker-compose up -d
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment**
   ```bash
   cp .env.example .env
   ```

4. **Run migrations**
   ```bash
   npx prisma migrate dev
   ```

5. **Seed database (optional)**
   ```bash
   npx prisma db seed
   ```

6. **Start development server**
   ```bash
   npm run start:dev
   ```

## API Documentation

Once running, access Swagger docs at:
- http://localhost:3000/api

## Project Structure

```
src/
├── main.ts              # Application entry point
├── app.module.ts        # Root module
├── prisma/              # Prisma service
└── modules/
    ├── auth/            # Authentication (JWT, SSO)
    ├── users/           # User profiles & preferences
    ├── content/         # CMS content items
    ├── mood/            # Mood tracking
    ├── journal/         # Journal entries
    ├── rituals/         # Custom rituals
    ├── subscriptions/   # RevenueCat integration
    ├── notifications/   # Push & reminders
    ├── feedback/        # Support & FAQs
    └── admin/           # Admin endpoints
```

## Available Scripts

- `npm run start` - Start production server
- `npm run start:dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run test` - Run tests
- `npm run lint` - Lint code
