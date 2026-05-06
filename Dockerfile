# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# ─── deps ──────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund --ignore-scripts --legacy-peer-deps

# ─── build ─────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ─── runtime ───────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -g 1001 -S nodejs \
 && adduser -S nextjs -u 1001 -G nodejs

COPY --from=build --chown=nextjs:nodejs /app/.next         ./.next
COPY --from=build --chown=nextjs:nodejs /app/public        ./public
COPY --from=build --chown=nextjs:nodejs /app/node_modules  ./node_modules
COPY --from=build --chown=nextjs:nodejs /app/package.json  ./package.json
COPY --from=build --chown=nextjs:nodejs /app/prisma        ./prisma
COPY --from=build --chown=nextjs:nodejs /app/scripts       ./scripts

USER nextjs
EXPOSE 3000

CMD ["npm", "run", "start"]
