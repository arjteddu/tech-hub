// Imported first thing in main.ts, before anything else — Sentry needs to
// initialize before the modules it instruments are required. No-op when
// SENTRY_DSN isn't set, so the app runs identically without an account.
import * as Sentry from "@sentry/node";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
  });
}
