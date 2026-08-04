# Multi-stage build for the background worker. Run from the repo root:
#   docker build -f apps/worker/Dockerfile -t tech-hub-worker .
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY . /repo
WORKDIR /repo

FROM base AS build
RUN pnpm install --frozen-lockfile
RUN pnpm --filter db generate
RUN pnpm --filter worker build
RUN pnpm --filter worker deploy --prod /prod/worker

FROM node:22-slim AS runner
WORKDIR /app
COPY --from=build /prod/worker .
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
