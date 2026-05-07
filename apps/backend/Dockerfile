FROM node:24-bookworm-slim AS build

WORKDIR /app/apps/backend

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY apps/backend/package*.json ./
RUN npm ci

COPY apps/backend/tsconfig.json ./
COPY apps/backend/src ./src
RUN npm run build

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_PATH=/data/slotgpt.db
ENV ENABLE_WORKERS=false

WORKDIR /app/apps/backend

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /data

COPY apps/backend/package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/apps/backend/dist ./dist

VOLUME ["/data"]
EXPOSE 3001

CMD ["node", "dist/index.js"]
