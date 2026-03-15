# HoppDrive

Affordable short- & long-term car rental platform for Switzerland. Built with a monorepo architecture using Turborepo.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS |
| Backend | Node.js + Express, TypeScript, Onion Architecture + DDD |
| Database | PostgreSQL 16 + Prisma ORM |
| Cache | Redis 7 |
| Auth | JWT (short-lived access + HTTP-only refresh cookie) |
| Email | Brevo (Sendinblue) |
| Images | sharp (WebP conversion) |
| Deployment | Docker, Nginx, Let's Encrypt |
| Compliance | FADP (Swiss) + GDPR |

## Project Structure

```
hoppdrive/
├── apps/
│   ├── api/                    # Express backend (Onion + DDD)
│   │   ├── src/
│   │   │   ├── domain/         # Entities, Value Objects, Repo Interfaces
│   │   │   ├── application/    # Use Cases, Service Interfaces
│   │   │   ├── infrastructure/ # Prisma repos, External services, DI
│   │   │   └── presentation/   # Routes, Middleware, Validators
│   │   └── prisma/             # Schema + Seed
│   └── web/                    # Next.js frontend
│       └── src/
│           ├── app/            # Pages (B2C + Admin CMS)
│           ├── components/     # Clean, reusable components
│           ├── hooks/          # Custom hooks (auth, consent)
│           └── lib/            # API client, utilities
├── packages/
│   └── shared/                 # Shared TypeScript types
├── nginx/                      # Nginx config
├── docker-compose.yml          # Production compose
├── docker-compose.dev.yml      # Dev DB + Redis
└── turbo.json                  # Turborepo pipeline
```

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (for databases)

### Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL + Redis
docker compose -f docker-compose.dev.yml up -d

# 3. Copy environment variables
cp .env.example .env
# Edit .env with your values

# 4. Generate Prisma client and push schema
npm run db:generate -w apps/api
npm run db:push -w apps/api

# 5. Seed the database
npm run db:seed -w apps/api

# 6. Start dev servers (API on :97, Web on :99, Admin on :98)
npm run dev
```

### Default Admin Credentials

After seeding:
- Email: `admin@hoppdrive.ch`
- Password: `ChangeMe123!@#`
- You will be forced to reset on first login.

Admin login: navigate to the site and click the tiny dot in the footer.

### Production Deployment

```bash
# 1. Set up environment variables
cp .env.example .env
# Edit with production values

# 2. Get initial SSL certificate
./init-ssl.sh

# 3. Build and start all containers
docker compose up -d --build

# 4. Run database migrations
docker compose exec api npx prisma db push --schema=apps/api/prisma/schema.prisma

# 5. Seed the database
docker compose exec api npx tsx apps/api/prisma/seed.ts
```

## Architecture (Backend)

The backend follows **Onion Architecture** with **Domain-Driven Design**:

```
┌───────────────────────────────────────────┐
│           Presentation Layer              │
│     (Routes, Middleware, Validators)      │
├───────────────────────────────────────────┤
│           Infrastructure Layer            │
│  (Prisma Repos, Redis, Brevo, JWT, etc.) │
├───────────────────────────────────────────┤
│           Application Layer               │
│   (Use Cases, Service Interfaces, DTOs)   │
├───────────────────────────────────────────┤
│             Domain Layer                  │
│  (Entities, Value Objects, Domain SVC)    │
└───────────────────────────────────────────┘
```

**Dependency rule**: Inner layers never depend on outer layers. Infrastructure implements interfaces defined in Domain/Application.

## Compliance

- **FADP / GDPR**: Cookie consent with zero-cookie-load, granular preferences (no dark patterns), privacy consent on forms, audit logging, automatic cleanup of old personal data (12-month retention).
- Privacy Policy and Impressum pages included.
- All consent fields use separate checkboxes (privacy ≠ marketing).

## License

Private. All rights reserved.
