FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --no-audit --no-fund --loglevel=error || npm install --no-audit --no-fund --loglevel=error

COPY . .

ARG BACKEND_API_URL
ENV BACKEND_API_URL=$BACKEND_API_URL

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
