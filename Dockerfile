# ─── Stage 1: Build React App ───
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ─── Stage 2: Production Server ───
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public/docs-registry.json ./public/docs-registry.json
COPY --from=builder /app/public/embeddings ./public/embeddings

EXPOSE 8080

CMD ["node", "server.js"]
