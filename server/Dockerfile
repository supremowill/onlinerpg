# Build stage
FROM node:18-alpine as builder
WORKDIR /app
COPY server/package*.json ./
RUN npm ci

COPY server/ ./
RUN npm run build

# Runtime stage
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/game_data.json ./

# Copy client (static frontend served by Express)
# This folder is expected at /app/public at runtime
COPY client ./public

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
