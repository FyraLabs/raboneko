FROM denoland/deno:latest AS builder
ENV DENO_DIR=/deno-dir
WORKDIR /app

# Copy files and install dependencies
COPY deno.json deno.lock ./
RUN deno ci --prod

# Move source files
COPY prisma ./prisma
COPY src ./src

# Generate Prisma files
RUN deno task generate

# Copy remaining files
COPY . .

# Production stage
FROM denoland/deno:latest
ENV DENO_DIR=/deno-dir
WORKDIR /app
COPY --from=builder /app .
COPY --from=builder /deno-dir /deno-dir
RUN chown -R deno node_modules

# Run Raboneko
USER deno
EXPOSE 3000/tcp
ENTRYPOINT [ "deno", "run", "--allow-net", "src/index.ts" ]
