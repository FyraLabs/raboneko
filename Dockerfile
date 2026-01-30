## build runner
FROM node:lts AS build-runner

# Add git
RUN apt update && apt install git

# Set temp directory
WORKDIR /tmp/app

# Move package.json
COPY package.json .

# Install dependencies
RUN npm install -g bun
RUN bun install

# Move source files
COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json   .

# Build project
RUN bunx prisma@7.3.0 generate
RUN bun run build

# Upload Sentry sourcemaps (Sentry Auth Token needed)
RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN,env=SENTRY_AUTH_TOKEN if [ ! -z ${SENTRY_AUTH_TOKEN} ]; then bun run sentry:sourcemaps; fi

## producation runner
FROM node:lts AS prod-runner

# Add git
RUN apt update && apt install git

# Set work directory
WORKDIR /app

# Copy package.json from build-runner
COPY --from=build-runner /tmp/app/package.json /app/package.json
# Copy prisma from build-runner
COPY --from=build-runner /tmp/app/prisma /app/prisma

# Install dependencies
RUN npm install -g bun
RUN bun install --production
RUN bunx prisma@7.3.0 generate

# Move build files
COPY --from=build-runner /tmp/app/dist /app/dist

# Start bot
CMD [ "node", "dist/index.js" ]
