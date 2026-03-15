FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --workspace=apps/api --workspace=packages/shared --include-workspace-root

# Build shared package
FROM deps AS build-shared
COPY packages/shared ./packages/shared
COPY tsconfig.base.json ./
RUN npm run build --workspace=packages/shared

# Build API
FROM build-shared AS build
COPY apps/api ./apps/api
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build --workspace=apps/api

# Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 expressjs

# Copy built output and node_modules
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json

# Create uploads directory
RUN mkdir -p /app/uploads && chown -R expressjs:nodejs /app/uploads

USER expressjs

EXPOSE 97

CMD ["node", "apps/api/dist/main.js"]
