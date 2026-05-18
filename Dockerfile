# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S nodejs && adduser -S appuser -G nodejs

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./package.json
COPY src/api ./src/api

USER appuser
EXPOSE 4000
CMD ["node", "src/api/app.js"]
