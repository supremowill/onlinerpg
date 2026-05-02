# Build stage
FROM node:18-alpine as builder
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --only=production

COPY server/ ./
RUN npm run build

# Runtime stage
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Copy client (static frontend served by Express)
# This folder is expected at /app/public at runtime
COPY client ./public

EXPOSE 3000
CMD ["node", "dist/index.js"]
