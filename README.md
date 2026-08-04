# tech-hub

Direct-to-consumer storefront: Next.js storefront, NestJS API, a BullMQ
worker, and Postgres — sized for roughly 1,000 concurrent shoppers. See the
architecture write-up shared alongside this repo for the reasoning behind
each choice; this README is just how to run it.

## Layout

```
apps/
  web/     Next.js 16 storefront (catalog, cart, checkout, orders)
  api/     NestJS backend (auth, catalog, cart, orders, payments, addresses)
  worker/  BullMQ consumer (order confirmation emails, inventory sync)
packages/
  db/      Prisma schema + generated client, shared by api and worker
  shared/  Queue names and job payload types shared by api and worker
```

## Prerequisites

- Node.js 22+, pnpm 10+ (`corepack enable` will pick up the pinned version)
- Docker, for local Postgres + Redis

## Local setup

```bash
docker compose up -d          # Postgres on :5432, Redis on :6379
pnpm install
cp .env.example apps/api/.env
cp .env.example apps/worker/.env       # only DATABASE_URL/REDIS_* apply here
cp apps/web/.env.local.example apps/web/.env.local
pnpm db:migrate                        # applies packages/db/prisma/migrations
pnpm dev                               # runs web (:3000), api (:4000), worker together
```

Open `http://localhost:3000`. There's no seed script yet, so the catalog
starts empty — add a product through Prisma Studio (`pnpm db:studio`) or
directly against the API to see the storefront populated.

## What's real vs. what's a placeholder

This scaffold was built and smoke-tested end-to-end against a live local
Postgres/Redis: register → browse → add to cart → add address → checkout →
Razorpay order creation → webhook → order marked PAID → confirmation job
picked up by the worker. All of that path works as written. A few things
are deliberately left for you to wire in:

- **Razorpay** — the checkout flow needs real `RAZORPAY_KEY_ID` /
  `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` from your Razorpay
  dashboard (Settings → API Keys, and Settings → Webhooks pointing at
  `POST /api/payments/webhook`). Without them, checkout will fail at the
  "create Razorpay order" step with a 401 from Razorpay — that's their API
  rejecting fake credentials, not a bug in this code.
- **Resend** — same idea for `RESEND_API_KEY`; without a real key the
  worker will correctly mark the confirmation-email job as failed (BullMQ
  will retry it) rather than silently pretending it sent.
- **Guest carts** — the architecture doc calls for guest carts in Redis;
  this scaffold's cart is DB-backed and requires sign-in. Worth adding
  before launch if you want browsing-without-an-account.
- **Catalog search** — currently a plain `ILIKE` filter. `schema.prisma`
  has a comment marking where a `tsvector` + GIN index migration would
  slot in for ranked full-text search.
- **Refresh-token storage** — tokens are returned in the JSON response and
  the frontend keeps them in `localStorage`. The architecture doc's
  recommendation (refresh token in an httpOnly cookie) is more resistant
  to XSS and is a reasonable hardening pass before launch.

## Deploying

- **web** → Vercel, pointed at `apps/web`, with `NEXT_PUBLIC_API_URL` set
  to your deployed API's URL.
- **api** / **worker** → each has a `Dockerfile` at its app root, written
  for Render (or anything else that builds from a Dockerfile). Build from
  the repo root: `docker build -f apps/api/Dockerfile -t tech-hub-api .`
  These weren't build-tested in this session (no Docker daemon available
  here) — smoke-test the image locally before pointing production traffic
  at it.
- **Database** → any managed Postgres (Neon, RDS, Supabase). Run
  `pnpm --filter db migrate:deploy` against it once, then on every deploy.
- **Redis** → Upstash or any managed Redis, referenced via `REDIS_HOST` /
  `REDIS_PORT` / `REDIS_PASSWORD`.

Full vendor list and monthly cost estimate are in the architecture
reference shared alongside this repo.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run web, api, and worker together |
| `pnpm build` | Build every app (db → web → api → worker) |
| `pnpm typecheck` / `pnpm lint` | Across every workspace package |
| `pnpm db:migrate` | Apply Prisma migrations locally |
| `pnpm db:studio` | Browse/edit data in Prisma Studio |

## Before this goes anywhere near real customers

Dependency versions here (NestJS 10, Prisma 5, Next 16) were pinned to
what installed and verified cleanly in this session — run `pnpm outdated`
and check in particular whether Prisma has a newer major worth adopting
before you build on top of this for real.
