import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './server/src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://localhost:5432/setgeliin_odod',
  },
});
