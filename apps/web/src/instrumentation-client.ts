// Client-side counterpart to instrumentation.ts. No-op when
// NEXT_PUBLIC_SENTRY_DSN isn't set — see the note there about verifying
// this against current @sentry/nextjs docs for Next.js 16.
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
  });
}
