# ─────────────────────────────────────────────────────────────────
# Stage 1: Builder
# ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Instala pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

WORKDIR /app

# Copia manifests do workspace para cache de layers
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Instala todas as dependências (incluindo devDeps para build)
RUN pnpm install --frozen-lockfile

# Copia código-fonte
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Build: shared primeiro, depois API
RUN pnpm --filter @condocloud/shared build
RUN pnpm --filter api build

# pnpm deploy: cria diretório auto-contido com prod deps + arquivos do pacote
RUN pnpm --filter api deploy --prod /app/deploy

# ─────────────────────────────────────────────────────────────────
# Stage 2: Runner (imagem final enxuta)
# ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Copia diretório de deploy auto-contido (node_modules + package.json)
COPY --from=builder /app/deploy .

# Copia dist compilado (pnpm deploy copia arquivos do pacote mas precisamos do dist)
COPY --from=builder /app/apps/api/dist ./dist

# Copia dist do shared (workspace dep resolvida via node_modules/symlink)
COPY --from=builder /app/packages/shared/dist ./node_modules/@condocloud/shared/dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check simples
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1 || exit 1

CMD ["node", "dist/main"]
