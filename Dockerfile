# ─── Stage 1: Build TypeScript ───────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install all deps (including devDeps for TypeScript compiler)
COPY server/package*.json ./
RUN npm ci

# Copy TypeScript source and compile
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

# ─── Stage 2: Lean Production Image ──────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install only production deps
COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled server code
COPY --from=builder /app/dist ./dist

# Copy SQL schema (used by auto-init in db.ts)
COPY server/init.sql ./init.sql

# Copy client static files (served by Express at /app/public)
COPY client ./public

EXPOSE 3000

CMD ["node", "dist/index.js"]
