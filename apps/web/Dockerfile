# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies separately so source changes can reuse this layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate \
    && pnpm install --filter eggcelerate-ui... --frozen-lockfile

COPY apps/web apps/web
RUN pnpm --filter eggcelerate-ui build

FROM nginx:alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
