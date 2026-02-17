# Build stage
FROM dhi.io/node:24-debian13-dev AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

RUN pnpm install --frozen-lockfile --prod


# Production
FROM dhi.io/node:24

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app/dist ./dist

COPY package.json ./

EXPOSE 3001

CMD ["node", "dist/index.js"]
