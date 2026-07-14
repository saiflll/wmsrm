FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund --loglevel=error || npm install --no-audit --no-fund --loglevel=error
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build
EXPOSE 3004
CMD ["npm", "start"]
