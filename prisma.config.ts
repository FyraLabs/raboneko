import process from "node:process";
import { defineConfig, env } from "prisma/config";

// Prisma is weird and does not like @std/dotenv/load, so /shrug
try {
  process.loadEnvFile();
} catch {
  // We aren't able to load the .env file, that's fine :)
}

export default defineConfig({
  datasource: {
    url: env("DATABASE_URL"),
  },
});
