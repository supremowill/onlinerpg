# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (including devDeps for tsc)
COPY package*.json ./
RUN npm ci

# Copy source and compile TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ─── Stage 2: Production image ────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled server
COPY --from=builder /app/dist ./dist

# Copy client (static frontend served by Express)
# This folder is expected at /app/public at runtime
COPY ../client ./public

EXPOSE 3000

CMD ["node", "dist/index.js"]
