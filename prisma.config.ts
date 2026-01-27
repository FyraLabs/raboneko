// ./prisma.config.ts
export default defineConfig({
    datasource: {
        url: env("DATABASE_URL"),
    }
})
