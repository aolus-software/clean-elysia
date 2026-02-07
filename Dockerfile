FROM oven/bun:1.1.13-alpine

WORKDIR /app

# Install Node.js (for drizzle-kit CLI)
RUN apk add --no-cache nodejs npm

# Install concurrently globally for build/start scripts
RUN npm install -g concurrently

COPY package.json bun.lock ./
RUN bun install --production --ignore-scripts

COPY . .

# Build the app (if needed)
RUN bun run build

EXPOSE 3000

CMD ["bun", "run", "start"]
