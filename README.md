# tech-hub

Direct-to-consumer storefront: Next.js storefront, NestJS API, a BullMQ
worker, and Postgres — sized for roughly 1,000 concurrent shoppers. See the
architecture write-up shared alongside this repo for the reasoning behind
each choice; this README is just how to run it.

## Layout

```
apps/
  web/     Next.js 16 storefront + a minimal /admin (catalog, cart, checkout, orders)
  api/     NestJS backend (auth, catalog, cart, orders, payments, addresses, media)
  worker/  BullMQ consumer (order confirmation emails, inventory sync)
packages/
  db/      Prisma schema + generated client, shared by api and worker
  shared/  Queue names + the wire contract (DTOs) shared by api and web
```

## Prerequisites

- Node.js 22+, pnpm 10+ (`corepack enable` will pick up the pinned version)
- Docker, for local Postgres + Redis

## Local setup

```bash
docker compose up -d          # Postgres on :5432, Redis on :6379
pnpm install                  # also wires up the pre-commit hook (husky)
cp .env.example apps/api/.env
cp .env.example apps/worker/.env       # only DATABASE_URL/REDIS_*/RESEND_* apply here
cp apps/web/.env.local.example apps/web/.env.local
pnpm db:migrate                        # applies packages/db/prisma/migrations
pnpm db:seed                           # a couple of categories/products to browse
pnpm dev                               # runs web (:3000), api (:4000), worker together
```

Open `http://localhost:3000`. Every environment variable in
`apps/api/.env` is validated on boot (`src/config/env.validation.ts`) — a
missing or malformed one fails startup immediately with a clear message
instead of surfacing as a confusing 500 later. `R2_*` and `SENTRY_DSN` are
optional — the app runs fine without them, only the features that need
them (image upload, error tracking) no-op or return a clear 503 until set.

### Making yourself an admin

There's no signup flow for admins on purpose — the first one has to be
promoted by hand. Register a normal account through the app, then:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'you@example.com';
```

Sign back in and an "Admin" link appears in the header, linking to
`/admin/products/new` and `/admin/categories/new` — real forms, including
image upload, not just API endpoints. It's deliberately bare (no product
listing/editing table yet) — enough to prove the write path and the
upload flow work, not a full admin console. Every admin write is enforced
server-side by a `RolesGuard`, independent of the UI: hit the endpoints
directly as a non-admin and you get a 403.

### API docs

With the api running, interactive Swagger docs are at
`http://localhost:4000/api/docs` (raw spec at `/api/docs-json`).

### Guest carts

Cart works before sign-in — the client generates a `X-Guest-Cart-Id` and
the api keeps that cart in Redis (7-day TTL). On login/register, whatever
was in it merges into the account's real (Postgres) cart and the Redis key
is deleted. Checkout still requires an account, same as most real stores.

### Search

Product search runs against a generated, GIN-indexed `tsvector` column
(name weighted above description), not a substring match — see
`packages/db/prisma/migrations/*_add_product_search` and
`CatalogService.searchProducts`.

### Caching

Catalog reads (`listProducts`, `getProductBySlug`, `listCategories`) are
cached in Redis via `CacheService`, invalidated by bumping a namespace
version on any admin write rather than hunting down individual keys.
Redis hiccups fail open — a cache miss falls back to Postgres, it never
breaks the request.

### Error tracking

Sentry is wired into both api (`@sentry/node`, a global exception filter
that reports 5xx only — 404s and validation errors aren't incidents) and
web (`@sentry/nextjs`, via `instrumentation.ts` / `instrumentation-client.ts`).
Both are no-ops until `SENTRY_DSN` (api, web-server) and
`NEXT_PUBLIC_SENTRY_DSN` (web-client) are set. The web-side wiring targets
current `@sentry/nextjs` conventions for Next.js 16 but wasn't verified
against a live Sentry project in this session — double-check it once you
have a real DSN.

### Tests

```bash
pnpm test          # api: auth + the checkout transaction; worker: order-confirmation email logic
```

The checkout transaction tests are the ones worth reading if you're
extending it — they cover the exact failure mode that matters most
(a variant selling out between browse and checkout) and assert the
transaction never partially reserves stock. `apps/web` has no automated
tests yet — the honest gap, see below.

### Pre-commit hooks

`pnpm install` wires up husky; every commit runs `eslint --fix` on staged
web files via lint-staged (`.husky/pre-commit`). api/worker aren't
included — their "lint" is a whole-project `tsc`, not something
per-file-stageable, so that stays a CI/pre-push concern.

## What's real vs. what's a placeholder

This scaffold was built and smoke-tested end-to-end against a live local
Postgres/Redis, repeatedly, including the full chain together in one run:
search → anonymous browsing → guest cart → register (cart merges) →
address → checkout → Razorpay order → webhook → order marked `PAID` →
worker picks up the confirmation job and correctly fails on a fake Resend
key rather than pretending it sent. What's still on you:

- **Razorpay** — needs real `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` /
  `RAZORPAY_WEBHOOK_SECRET` from your dashboard (Settings → API Keys, and
  Settings → Webhooks pointing at `POST /api/payments/webhook`). Without
  them, checkout fails at "create Razorpay order" with a 401 — that's
  their API rejecting fake credentials, not a bug here.
- **Resend** — same idea for `RESEND_API_KEY`; without a real key the
  worker correctly marks the confirmation-email job failed (BullMQ
  retries it) instead of silently pretending it sent.
- **R2** — needs real `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` /
  `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` / `R2_PUBLIC_URL` from the
  Cloudflare dashboard. Without them, `POST /media/presign` returns a
  clean 503, not a 500 — the admin product form's upload step will just
  show that as an error.
- **Sentry** — see above; the wiring exists but wasn't tested against a
  live project.
- **Refresh-token storage** — tokens live in the JSON response and the
  frontend keeps them in `localStorage`. The architecture doc's
  recommendation (refresh token in an httpOnly cookie) is more resistant
  to XSS and is a reasonable hardening pass before launch.
- **`apps/web` has no automated tests** — `apps/api` and `apps/worker`
  both do; the frontend doesn't have a test runner wired up at all yet.
- **Admin UI is minimal on purpose** — create-only forms, no listing,
  editing, or order management screens. The endpoints and RBAC are real;
  the console around them isn't built.
- **PgBouncer** isn't something to add to this repo — it's a setting you
  turn on with whichever managed Postgres you pick (Neon/Supabase hand
  you a pooled connection string directly).

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
- **Media** → a Cloudflare R2 bucket with public access (or a custom
  domain) for `R2_PUBLIC_URL`.

Full vendor list and monthly cost estimate are in the architecture
reference shared alongside this repo.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run web, api, and worker together |
| `pnpm build` | Build every app (db → web → api → worker) |
| `pnpm typecheck` / `pnpm lint` | Across every workspace package |
| `pnpm test` | Jest tests for the api and the worker |
| `pnpm db:migrate` | Apply Prisma migrations locally |
| `pnpm db:seed` | Populate a couple of categories/products |
| `pnpm db:studio` | Browse/edit data in Prisma Studio |

## Before this goes anywhere near real customers

Dependency versions here were pinned to what installed and verified
cleanly in this session (NestJS 10, Prisma 5, Next 16, Sentry SDK 10) —
run `pnpm outdated` periodically, and Dependabot is already configured
(`.github/dependabot.yml`) to open update PRs weekly. `pnpm audit` also
runs in CI (non-blocking) — it currently flags a couple of high-severity
transitive advisories in `@nestjs/platform-express` and `@nestjs/swagger`'s
own dependencies, not something fixable by bumping this repo's direct
pins; they'll clear once those packages update upstream.
