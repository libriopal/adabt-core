FROM node:24-bookworm-slim AS build

WORKDIR /app/apps/frontend

COPY apps/frontend/package*.json ./
RUN npm ci

COPY apps/frontend/index.html ./
COPY apps/frontend/tsconfig.json ./
COPY apps/frontend/vite.config.ts ./
COPY apps/frontend/src ./src
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
