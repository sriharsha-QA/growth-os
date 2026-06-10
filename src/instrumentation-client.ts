import * as Sentry from "@sentry/nextjs";

/**
 * Sentry client instrumentation (v3.1 §10 — D10 resolution).
 * Loaded automatically by Next.js when this file exists at src/.
 * PII scrubbing: beforeSend strips user emails/IPs from events.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  // Capture 100% of transactions in development; 10% in production.
  // Adjust tracesSampleRate in production once baseline is established.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  // Capture replays only on sessions that encounter an error.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: process.env.NODE_ENV === "production" ? 1.0 : 0,

  beforeSend(event) {
    // Strip PII: remove email addresses and IP from user context.
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    return event;
  },
});
