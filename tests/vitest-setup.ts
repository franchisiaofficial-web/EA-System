import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '..', '.env.test') });

if (!process.env.TEST_DATABASE_URL) {
  console.warn('WARNING: TEST_DATABASE_URL is not set in .env.test');
}

// Set DATABASE_URL for Prisma service layer imports in tests
if (!process.env.DATABASE_URL && process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
