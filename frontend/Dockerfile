FROM dhi.io/bun:1-debian13-dev AS builder

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

COPY . .

RUN bun run build

# Production
FROM dhi.io/nginx:1.31

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

# HEALTHCHECK CMD does not inherit the base image ENTRYPOINT (nginx), so the
# binary must be named explicitly. This hardened image ships no shell/wget/curl,
# so we validate nginx config rather than probe over HTTP.
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD ["nginx", "-t"]

EXPOSE 80

CMD ["-g", "daemon off;"]
