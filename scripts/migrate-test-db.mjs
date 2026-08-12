import 'dotenv/config';
import { execSync } from 'node:child_process';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Set TEST_DATABASE_URL or DATABASE_URL before running the e2e suite.');
  process.exit(1);
}

execSync('npx prisma migrate deploy', {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: databaseUrl },
});
