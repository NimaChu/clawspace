FROM docker.io/library/node:24-bookworm-slim AS build

WORKDIR /app

# canvas may fall back to a source build when a matching prebuilt binary is unavailable.
RUN sed -i 's|http://deb.debian.org|http://mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential \
    libcairo2-dev \
    libgif-dev \
    libjpeg62-turbo-dev \
    libpango1.0-dev \
    librsvg2-dev \
    pkg-config \
    python3 \
  && rm -rf /var/lib/apt/lists/*

COPY platform/web/package.json platform/web/package-lock.json ./
RUN npm ci

COPY platform/web/apps/sources/comeback/package.json platform/web/apps/sources/comeback/package-lock.json ./apps/sources/comeback/
RUN npm ci --prefix apps/sources/comeback

COPY platform/web/ .
COPY skills/clawapp-creator /skills/clawapp-creator
RUN npm run build \
  && npm prune --omit=dev

FROM docker.io/library/node:24-bookworm-slim AS runtime

WORKDIR /app

RUN sed -i 's|http://deb.debian.org|http://mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    libcairo2 \
    libgif7 \
    libjpeg62-turbo \
    libpango-1.0-0 \
    librsvg2-2 \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321 \
    OBJECT_STORAGE_PROVIDER=filesystem \
    DATABASE_URL="" \
    BLOB_READ_WRITE_TOKEN=""

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

RUN mkdir -p /app/runtime/data /app/runtime/hosted-apps /app/runtime/downloads

EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4321/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "./dist/server/entry.mjs"]
