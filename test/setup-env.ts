import 'dotenv/config';

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

process.env.NODE_ENV = 'test';
process.env.SLA_SCAN_INTERVAL_MS = '3600000';
process.env.BUSINESS_TIMEZONE = 'Europe/Belgrade';
process.env.BUSINESS_START_HOUR = '9';
process.env.BUSINESS_END_HOUR = '17';
process.env.BUSINESS_WORKDAYS = '1,2,3,4,5';
process.env.BUSINESS_HOLIDAYS = '';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-long-enough-for-joi';
