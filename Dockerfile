# Use official Node.js image
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy all source files
COPY . ./

# Build Next.js app
RUN npx next build --webpack

# Production image
FROM node:20-alpine AS runner
WORKDIR /app

# Install dotenv explicitly for runtime configuration
RUN npm install dotenv

# Copy standalone build
COPY --from=builder /app/.next/standalone ./
# Copy static assets
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

ENV NODE_ENV=production

# Allow runtime environment variables to be passed
# Usage: docker run -e NEXT_PUBLIC_DB_API_URL=http://your-host:5000/api
# Or mount .env file: docker run -v /path/to/.env:/app/.env

CMD ["node", "-r", "dotenv/config", "server.js"]
