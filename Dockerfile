*** File: Dockerfile

# Cloud Run container for the Functions Framework handler in index.js
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 8080

CMD ["npm", "start"]
