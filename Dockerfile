# =============================================================================
# IOF OBP Demo Server — Production Dockerfile
# =============================================================================
# Multi-stage build: builder (compile) → runner (minimal runtime)
# Images pushed to ECR as 697697502658.dkr.ecr.eu-west-1.amazonaws.com/iof/obp-demo-server:<sha>
# =============================================================================

# Build stage
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat \
 && corepack enable && corepack prepare pnpm@9.14.2 --activate

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy ALL package.json files for proper workspace resolution
COPY packages/utils/package.json ./packages/utils/
COPY packages/errors/package.json ./packages/errors/
COPY packages/service-core/package.json ./packages/service-core/
COPY packages/contracts-core/package.json ./packages/contracts-core/
COPY packages/rules-engine-core/package.json ./packages/rules-engine-core/
COPY packages/jurisdiction-profiles/package.json ./packages/jurisdiction-profiles/
COPY packages/db-core/package.json ./packages/db-core/
COPY packages/auth-core/package.json ./packages/auth-core/
COPY packages/ledger-core/package.json ./packages/ledger-core/
COPY packages/search-core/package.json ./packages/search-core/
COPY packages/webhook-core/package.json ./packages/webhook-core/
COPY packages/audit-core/package.json ./packages/audit-core/
COPY packages/entitlements-core/package.json ./packages/entitlements-core/
COPY packages/workspace-core/package.json ./packages/workspace-core/
COPY packages/stripe-metering/package.json ./packages/stripe-metering/
COPY packages/obp-client/package.json ./packages/obp-client/
COPY packages/load-testing-core/package.json ./packages/load-testing-core/
COPY packages/event-envelope/package.json ./packages/event-envelope/
COPY packages/event-schema-registry/package.json ./packages/event-schema-registry/
COPY services/obp-demo-server/package.json ./services/obp-demo-server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/ ./packages/
COPY services/obp-demo-server/ ./services/obp-demo-server/

# Generate Prisma client
RUN cd packages/db-core && pnpm db:generate

# Build all required packages
# TigerStyle: Build order MUST respect dependency graph
# Level 0: no workspace deps
RUN pnpm --filter @iof/utils build
RUN pnpm --filter @iof/errors build
# Level 1: depends on level 0
RUN pnpm --filter @iof/db-core build
# Level 2: depends on level 1
RUN pnpm --filter @iof/auth-core build
RUN pnpm --filter @iof/obp-client build
# Level 3: depends on level 2 (auth-core)
RUN pnpm --filter @iof/service-core build
# Level 4: service
RUN pnpm --filter @iof/obp-demo-server build

# Create deployment bundle with flat node_modules (no pnpm symlinks)
RUN pnpm deploy --filter @iof/obp-demo-server --prod /app/deployed
RUN cp -r /app/services/obp-demo-server/dist /app/deployed/dist
# Copy generated Prisma client from workspace to deployed bundle.
# prisma generate outputs to .prisma/client/ (runtime) AND @prisma/client/ (package entry).
# pnpm deploy creates a new store entry with un-generated stubs, so we overwrite both.
RUN SRC_BASE=$(find /app/node_modules/.pnpm -maxdepth 1 -name "@prisma+client@*" -type d | head -1)/node_modules && \
    DST_BASE=$(find /app/deployed/node_modules/.pnpm -maxdepth 1 -name "@prisma+client@*" -type d | head -1)/node_modules && \
    cp -r "$SRC_BASE/@prisma/client"/* "$DST_BASE/@prisma/client/" && \
    cp -r "$SRC_BASE/.prisma" "$DST_BASE/"

# Stage 2: Production runtime
FROM node:22-alpine AS runner

RUN apk add --no-cache libc6-compat dumb-init \
 && addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 iof

WORKDIR /app

ENV NODE_ENV=production

LABEL org.opencontainers.image.title="IOF OBP Demo Server" \
      org.opencontainers.image.description="Islamic Open Finance OBP Demo Server — sandbox testing" \
      org.opencontainers.image.vendor="Islamic Open Finance" \
      org.opencontainers.image.source="https://github.com/Islamic-Open-Finance/app" \
      org.opencontainers.image.licenses="Apache-2.0"

# Copy deployed bundle (flat node_modules, no symlinks)
COPY --from=builder --chown=iof:nodejs /app/deployed ./

USER iof

# TigerStyle: Port must match PORTS.md SSOT (obp-demo-server: 3005)
EXPOSE 3005

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3005/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
