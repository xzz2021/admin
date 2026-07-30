# ===== builder：安装依赖 + prisma generate + nest build =====
FROM node:24.18 AS builder

WORKDIR /app

RUN npm i -g pnpm@11.13.1

# 切换 pnpm 源为镜像源
RUN pnpm config set registry https://registry.npmmirror.com

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
# COPY packages packages/

# 使用 BuildKit 缓存 pnpm store
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile

COPY . .

# 设置构建期所需的占位环境变量
ENV PG_DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

RUN pnpm --filter server exec prisma generate
RUN pnpm --filter server build

# ===== migrator：一次性执行数据库迁移（复用 builder，含 prisma CLI）=====
FROM builder AS migrator

WORKDIR /app/apps/server

ENV NODE_ENV=production

CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm exec prisma db seed"]

# ===== runner：仅运行 Nest 应用 =====
FROM node:24.18-alpine3.24 AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache postgresql18-client \
  && pg_dump --version

RUN npm i -g pnpm@11.13.1

# 切换 pnpm 源为镜像源
RUN pnpm config set registry https://registry.npmmirror.com

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
# COPY packages packages/



# 避免husky报错
# 使用 BuildKit 缓存 pnpm store
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
  pnpm install --prod --frozen-lockfile --filter server... --ignore-scripts \
  && pnpm rebuild argon2 \
  && chown -R node:node /app

COPY --from=builder --chown=node:node /app/apps/server/dist apps/server/dist
COPY --from=builder --chown=node:node /app/apps/server/public apps/server/public

WORKDIR /app/apps/server

USER node

EXPOSE 3000

CMD ["node", "dist/src/main.js"]
