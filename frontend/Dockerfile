FROM dhi.io/bun:1-debian13-dev AS builder

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

COPY . .

RUN bun run build

# Production
FROM dhi.io/nginx:1.28

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD ["-t"]

EXPOSE 80

CMD ["-g", "daemon off;"]
