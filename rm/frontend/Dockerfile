FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --no-audit --no-fund --loglevel=error || npm install --no-audit --no-fund --loglevel=error

COPY . .

ARG BACKEND_API_URL
ENV BACKEND_API_URL=$BACKEND_API_URL
ARG NEXT_PUBLIC_APP_VERSION=1.2.0
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
