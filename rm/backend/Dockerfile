FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --no-audit --no-fund --loglevel=error || npm install --no-audit --no-fund --loglevel=error

COPY . .

RUN npm run build

EXPOSE 3001

CMD ["npm", "run", "start:prod"]
