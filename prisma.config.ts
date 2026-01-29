import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// ./prisma.config.ts
export default defineConfig({
  datasource: {
    url: env('DATABASE_URL'),
  },
});
