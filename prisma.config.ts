// ./prisma.config.ts
export default defineConfig({
    datasource: {
        url: process.env.DATABASE_URL,
    }
})
