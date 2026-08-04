import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),

  DATABASE_URL: Joi.string()
    .uri({ scheme: [/postgres(ql)?/] })
    .required(),

  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),

  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),

  BUSINESS_TIMEZONE: Joi.string().default('Europe/Belgrade'),
  BUSINESS_START_HOUR: Joi.number().integer().min(0).max(23).default(9),
  BUSINESS_END_HOUR: Joi.number()
    .integer()
    .min(1)
    .max(24)
    .default(17)
    .greater(Joi.ref('BUSINESS_START_HOUR')),
  BUSINESS_WORKDAYS: Joi.string()
    .pattern(/^[1-7](,[1-7])*$/)
    .default('1,2,3,4,5'),
  BUSINESS_HOLIDAYS: Joi.string()
    .allow('')
    .pattern(/^(\d{4}-\d{2}-\d{2})(,\d{4}-\d{2}-\d{2})*$/)
    .default(''),

  SLA_SCAN_INTERVAL_MS: Joi.number().integer().min(1000).default(60_000),
});
