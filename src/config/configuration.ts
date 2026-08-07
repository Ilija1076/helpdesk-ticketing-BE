import { BusinessCalendar } from '../sla/business-calendar';

export interface AppConfiguration {
  nodeEnv: string;
  port: number;
  jwt: {
    secret: string;
    expiresIn: string;
    refreshTokenDays: number;
  };
  redis: {
    host: string;
    port: number;
  };
  sla: {
    scanIntervalMs: number;
  };
  businessCalendar: BusinessCalendar;
}

const parseList = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

export const configuration = (): AppConfiguration => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  jwt: {
    secret: process.env.JWT_SECRET as string,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS ?? 30),
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
  },
  sla: {
    scanIntervalMs: Number(process.env.SLA_SCAN_INTERVAL_MS ?? 60_000),
  },
  businessCalendar: {
    timezone: process.env.BUSINESS_TIMEZONE ?? 'Europe/Belgrade',
    startHour: Number(process.env.BUSINESS_START_HOUR ?? 9),
    endHour: Number(process.env.BUSINESS_END_HOUR ?? 17),
    workdays: parseList(process.env.BUSINESS_WORKDAYS ?? '1,2,3,4,5').map(Number),
    holidays: parseList(process.env.BUSINESS_HOLIDAYS),
  },
});
