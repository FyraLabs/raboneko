import * as Sentry from '@sentry/deno';

if (process.env.SENTRY_DSN)
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    sendDefaultPii: true,
    integrations: [Sentry.extraErrorDataIntegration()],
  });
