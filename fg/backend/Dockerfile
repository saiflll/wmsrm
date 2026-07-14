FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund --loglevel=error || npm install --no-audit --no-fund --loglevel=error
COPY . .
RUN npm run build
EXPOSE 3003
CMD ["node", "dist/main.js"]
