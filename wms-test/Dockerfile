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

RUN apk add --no-cache postgresql-client supervisor bash

WORKDIR /app

COPY --from=rm-backend-builder /build/dist /app/rm-backend/dist
COPY --from=rm-backend-builder /build/node_modules /app/rm-backend/node_modules
COPY --from=rm-backend-builder /build/package.json /app/rm-backend/package.json

COPY --from=rm-frontend-builder /build/ /app/rm-frontend/

COPY wms-test/wrappers /app/wrappers
RUN chmod +x /app/wrappers/*.sh

COPY wms-test/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

COPY wms-test/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3011 3012 3015

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3011/ || exit 1

ENTRYPOINT ["/entrypoint.sh"]
