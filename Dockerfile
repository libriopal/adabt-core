# ── Stage 1: Build frontend ──────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app/apps/frontend
COPY apps/frontend/package.json apps/frontend/package-lock.json ./
RUN npm ci
COPY apps/frontend/ ./
RUN npm run build

# ── Stage 2: Build backend ───────────────────────────────────────────────────
FROM node:20-alpine AS backend-build
# better-sqlite3 needs build tools for native compilation
RUN apk add --no-cache python3 make g++
WORKDIR /app/apps/backend
COPY apps/backend/package.json apps/backend/package-lock.json ./
RUN npm ci
COPY apps/backend/ ./
RUN npm run build

# ── Stage 3: Production image ────────────────────────────────────────────────
FROM node:20-alpine AS production
RUN apk add --no-cache python3 make g++
WORKDIR /app

# Backend compiled output + production deps
COPY --from=backend-build /app/apps/backend/dist ./apps/backend/dist
COPY --from=backend-build /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=backend-build /app/apps/backend/package-lock.json ./apps/backend/package-lock.json
WORKDIR /app/apps/backend
RUN npm ci --omit=dev

# Frontend built output (served by backend in production)
WORKDIR /app
COPY --from=frontend-build /app/apps/frontend/dist ./apps/frontend/dist

# Data directory for SQLite — mount a Railway Volume here for persistence
ENV DATA_DIR=/data
RUN mkdir -p /data

WORKDIR /app/apps/backend
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["node", "dist/index.js"]
