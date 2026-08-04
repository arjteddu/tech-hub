// Next.js's own instrumentation hook (not Sentry-specific) — runs once
// per server/edge runtime on boot. No-op when SENTRY_DSN isn't set.
//
// NOTE: written against @sentry/nextjs's current server-init pattern as
// of this writing; Next.js 16 is genuinely new (see apps/web/AGENTS.md —
// its own docs bundle warns APIs may differ from training data). Verify
// this against the live @sentry/nextjs docs before relying on it.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (!process.env.SENTRY_DSN) return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
  });
}

export const onRequestError = Sentry.captureRequestError;
