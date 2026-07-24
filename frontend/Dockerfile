# Multi-stage build: compile the Vite/React app, then serve the static
# output with nginx (which also reverse-proxies /api, /admin, and /static to
# the Django backend so the whole app is same-origin from the browser --
# no CORS or build-time VITE_API_BASE_URL configuration required).

FROM oven/bun:1 AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
