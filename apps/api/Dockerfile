# Multi-stage build for the API. Run from the repo root:
#   docker build -f apps/api/Dockerfile -t tech-hub-api .
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY . /repo
WORKDIR /repo

FROM base AS build
RUN pnpm install --frozen-lockfile
RUN pnpm --filter db generate
RUN pnpm --filter api build
RUN pnpm --filter api deploy --prod /prod/api

FROM node:22-slim AS runner
WORKDIR /app
COPY --from=build /prod/api .
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/main.js"]
