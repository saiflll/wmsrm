FROM node:20-alpine AS rm-backend-builder
WORKDIR /build
COPY rm/backend/package*.json ./
RUN npm install --no-audit --no-fund --loglevel=error
COPY rm/backend/ .
RUN npm run build

FROM node:20-alpine AS rm-frontend-builder
WORKDIR /build
COPY rm/frontend/package*.json ./
RUN npm install --no-audit --no-fund --loglevel=error
COPY rm/frontend/ .
ARG BACKEND_API_URL=http://localhost:3011
ENV BACKEND_API_URL=$BACKEND_API_URL
RUN npm run build

FROM node:20-alpine

RUN apk add --no-cache postgresql postgresql-client supervisor bash

ENV POSTGRES_USER=wms_user
ENV POSTGRES_PASSWORD=wms_password
ENV POSTGRES_DB=wms_db
ENV PGDATA=/var/lib/postgresql/data

WORKDIR /app

COPY --from=rm-backend-builder /build/dist /app/rm-backend/dist
COPY --from=rm-backend-builder /build/node_modules /app/rm-backend/node_modules
COPY --from=rm-backend-builder /build/package.json /app/rm-backend/package.json

COPY --from=rm-frontend-builder /build/ /app/rm-frontend/

COPY wms-test/wrappers /app/wrappers
RUN chmod +x /app/wrappers/*.sh

COPY wms-test/postgresql.conf /etc/postgresql/postgresql.conf
COPY wms-test/pg_hba.conf /etc/postgresql/pg_hba.conf

COPY wms-test/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

COPY wms-test/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3011 3012 3015

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD pg_isready -U wms_user -d wms_db || exit 1

ENTRYPOINT ["/entrypoint.sh"]
