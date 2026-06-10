import * as Sentry from "@sentry/nextjs";

/**
 * Sentry server instrumentation.
 * Next.js 15+ loads this file automatically for the Node.js runtime.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  beforeSend(event) {
    // Strip PII from server events.
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    return event;
  },
});
