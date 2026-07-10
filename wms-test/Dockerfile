# ============================================================
# Stage 1: Build fg-backend (NestJS)
# ============================================================
FROM node:20-alpine AS fg-backend-builder
WORKDIR /build
COPY fg/backend/package*.json ./
RUN npm install --no-audit --no-fund --loglevel=error
COPY fg/backend/ .
RUN npm run build

# ============================================================
# Stage 2: Build fg-frontend (Next.js)
# ============================================================
FROM node:20-alpine AS fg-frontend-builder
WORKDIR /build
COPY fg/frontend/package*.json ./
RUN npm install --no-audit --no-fund --loglevel=error
COPY fg/frontend/ .
ARG NEXT_PUBLIC_API_URL=http://localhost:3013
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

# ============================================================
# Stage 3: Build rm-backend (NestJS)
# ============================================================
FROM node:20-alpine AS rm-backend-builder
WORKDIR /build
COPY rm/backend/package*.json ./
RUN npm install --no-audit --no-fund --loglevel=error
COPY rm/backend/ .
RUN npm run build

# ============================================================
# Stage 4: Build rm-frontend (Next.js)
# ============================================================
FROM node:20-alpine AS rm-frontend-builder
WORKDIR /build
COPY rm/frontend/package*.json ./
RUN npm install --no-audit --no-fund --loglevel=error
COPY rm/frontend/ .
ARG BACKEND_API_URL=http://localhost:3011
ENV BACKEND_API_URL=$BACKEND_API_URL
RUN npm run build

# ============================================================
# Stage 5: Production image
# ============================================================
FROM node:20-alpine

RUN apk add --no-cache postgresql postgresql-client supervisor bash

# --- PostgreSQL setup ---
ENV POSTGRES_USER=wms_user
ENV POSTGRES_PASSWORD=wms_password
ENV POSTGRES_DB=wms_db
ENV PGDATA=/var/lib/postgresql/data

# --- App directories ---
WORKDIR /app

# Copy compiled fg-backend
COPY --from=fg-backend-builder /build/dist /app/fg-backend/dist
COPY --from=fg-backend-builder /build/node_modules /app/fg-backend/node_modules
COPY --from=fg-backend-builder /build/package.json /app/fg-backend/package.json

# Copy compiled fg-frontend (full source needed for next start)
COPY --from=fg-frontend-builder /build/ /app/fg-frontend/

# Copy compiled rm-backend
COPY --from=rm-backend-builder /build/dist /app/rm-backend/dist
COPY --from=rm-backend-builder /build/node_modules /app/rm-backend/node_modules
COPY --from=rm-backend-builder /build/package.json /app/rm-backend/package.json

# Copy compiled rm-frontend (full source needed for next start)
COPY --from=rm-frontend-builder /build/ /app/rm-frontend/

# --- Wrapper scripts ---
COPY wms-test/wrappers /app/wrappers
RUN chmod +x /app/wrappers/*.sh

# --- Supervisor config ---
COPY wms-test/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# --- Entrypoint ---
COPY wms-test/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3010 3011 3012 3013 3015

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD pg_isready -U wms_user -d wms_db || exit 1

ENTRYPOINT ["/entrypoint.sh"]
