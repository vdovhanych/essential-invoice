# Build stage
FROM dhi.io/bun:1-debian13-dev AS builder

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

COPY . .

RUN bun run build

RUN bun install --production --frozen-lockfile


# Production
FROM dhi.io/bun:1

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app/dist ./dist

COPY package.json ./

EXPOSE 3001

CMD ["bun", "dist/index.js"]
