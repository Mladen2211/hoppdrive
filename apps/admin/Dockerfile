FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/admin/package.json ./apps/admin/
COPY packages/shared/package.json ./packages/shared/
COPY packages/tailwind-config/package.json ./packages/tailwind-config/
RUN npm ci --workspace=apps/admin --workspace=packages/shared --workspace=packages/tailwind-config --include-workspace-root

# Build shared package + Tailwind preset (apps load the preset from its dist/)
FROM deps AS build-shared
COPY packages/shared ./packages/shared
COPY packages/tailwind-config ./packages/tailwind-config
COPY tsconfig.base.json ./
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/tailwind-config

# Build Next.js admin app
FROM build-shared AS build
COPY apps/admin ./apps/admin

# Set build-time env vars
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ARG NEXT_PUBLIC_MAPBOX_TOKEN
ENV NEXT_PUBLIC_MAPBOX_TOKEN=${NEXT_PUBLIC_MAPBOX_TOKEN}

RUN npm run build --workspace=apps/admin

# Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=build /app/apps/admin/.next/standalone ./
COPY --from=build /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=build /app/apps/admin/public ./apps/admin/public

USER nextjs

EXPOSE 98

ENV PORT=98
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/admin/server.js"]
