# ------------------------------------------------------------
# Base
# ------------------------------------------------------------
FROM node:24-trixie-slim AS base
ENV DEBIAN_FRONTEND=noninteractive

# Install pnpm globally
RUN npm install -g pnpm@10.7.1

# ------------------------------------------------------------
# libavif builder (newer than trixie)
# Both libavif and libaom are fetched from HEAD at build time:
#   - libavif: git clone --depth 1 (always latest commit)
#   - libaom:  fetched by libavif cmake FetchContent (DAVIF_CODEC_AOM=LOCAL)
# Last reviewed: 2026-03-04
# To check what changed since last review, compare commits from that date:
#   https://github.com/AOMediaCodec/libavif/commits/main
#   https://aomedia.googlesource.com/aom/+log/refs/heads/main
# ------------------------------------------------------------
FROM base AS libavif-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
  build-essential \
  cmake \
  git \
  nasm \
  pkg-config \
  libdav1d-dev \
  libjpeg-dev \
  libpng-dev \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /tmp

RUN git clone --depth 1 https://github.com/AOMediaCodec/libavif.git \
 && cd libavif \
 && cmake -S . -B build \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX=/usr/local \
    -DBUILD_SHARED_LIBS=OFF \
    -DAVIF_BUILD_APPS=ON \
    -DAVIF_CODEC_AOM=LOCAL \
    -DAVIF_CODEC_DAV1D=SYSTEM \
    -DAVIF_CODEC_LIBGAV1=OFF \
    -DAVIF_CODEC_RAV1E=OFF \
    -DAVIF_CODEC_SVT=OFF \
    -DAVIF_LIBYUV=LOCAL \
    -DAVIF_ENABLE_WERROR=OFF \
 && cmake --build build \
 && cmake --install build

# ------------------------------------------------------------
# deps
# ------------------------------------------------------------
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ------------------------------------------------------------
# builder
# ------------------------------------------------------------
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm run build

# ------------------------------------------------------------
# runner
# ------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update && apt-get install -y --no-install-recommends \
  ffmpeg \
  curl \
  postgresql-client-17 \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copy only libavif tools
COPY --from=libavif-builder /usr/local/bin/avifenc /usr/local/bin/avifenc
COPY --from=libavif-builder /usr/local/bin/avifdec /usr/local/bin/avifdec

RUN groupadd --gid 1001 nodejs \
  && useradd --uid 1001 --gid nodejs --create-home nextjs

COPY --from=builder /app/public ./public

RUN mkdir .next && chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY --from=builder /app/scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p /app/db-backups && chown nextjs:nodejs /app/db-backups

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:${PORT}/api/health || exit 1

CMD ["sh", "/usr/local/bin/docker-entrypoint.sh"]