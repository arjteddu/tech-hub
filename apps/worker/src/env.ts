const REQUIRED = ["DATABASE_URL", "REDIS_HOST", "RESEND_API_KEY", "ORDERS_FROM_EMAIL"] as const;

// Same idea as the api's Joi schema, sized for a single process: fail
// loudly on boot rather than send silently-broken confirmation emails.
export function assertEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }
}
