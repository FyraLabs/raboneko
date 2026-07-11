FROM denoland/deno:latest AS builder
ENV DENO_DIR=/deno-dir
WORKDIR /app

# Copy files and install dependencies
COPY deno.json deno.lock package.json* ./
RUN deno ci --prod

# Move source files
COPY . .

# Generate Prisma files
RUN deno task generate

# Production stage
FROM denoland/deno:latest
ENV DENO_DIR=/deno-dir
WORKDIR /app
COPY --from=builder /app .
COPY --from=builder /deno-dir /deno-dir

# Run Raboneko
USER deno
EXPOSE 3000/tcp
ENTRYPOINT [ "deno", "run", "--allow-net", "src/index.ts" ]
