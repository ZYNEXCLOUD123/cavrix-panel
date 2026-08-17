FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
RUN npm ci --ignore-scripts --no-audit --no-fund
RUN cd backend && npm ci --ignore-scripts --no-audit --no-fund
RUN cd frontend && npm ci --ignore-scripts --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache curl

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/package*.json ./backend/
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/package*.json ./

RUN addgroup -g 1001 cavrix && adduser -u 1001 -G cavrix -s /bin/sh -D cavrix
RUN mkdir -p /app/data /app/backups && chown -R cavrix:cavrix /app

USER cavrix

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "backend/dist/index.js"]
