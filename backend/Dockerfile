# Install dependencies
FROM dhi.io/bun:1-debian13-dev AS deps

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile --production


# Production
FROM dhi.io/bun:1

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY src ./src

COPY package.json ./

EXPOSE 3001

CMD ["bun", "src/index.ts"]
