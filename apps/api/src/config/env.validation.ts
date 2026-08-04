import * as Joi from "joi";

// Fails fast on boot with a readable error if the environment is
// misconfigured, instead of limping along with `undefined` secrets that
// only surface as a confusing 500 the first time something needs them.
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "production", "test").default("development"),
  PORT: Joi.number().default(4000),

  DATABASE_URL: Joi.string().uri({ scheme: ["postgresql", "postgres"] }).required(),

  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow("").optional(),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),

  WEB_ORIGIN: Joi.string().required(),

  RAZORPAY_KEY_ID: Joi.string().required(),
  RAZORPAY_KEY_SECRET: Joi.string().required(),
  RAZORPAY_WEBHOOK_SECRET: Joi.string().required(),
});
