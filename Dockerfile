# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm via corepack (matches pnpm-lock.yaml)
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@latest --activate \
    && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Production: nginx serving static dist/
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
