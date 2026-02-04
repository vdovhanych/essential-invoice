# Build stage
FROM dhi.io/node:24-debian13-dev AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including dev for build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm run build

# Prune to production dependencies only
RUN pnpm install --frozen-lockfile --prod


# Production stage (distroless – no shell, no Chromium needed)
FROM dhi.io/node:24

WORKDIR /app

# Copy production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy built files from builder
COPY --from=builder /app/dist ./dist


# Copy package.json for Node.js module resolution
COPY package.json ./

EXPOSE 3001

CMD ["node", "dist/index.js"]
