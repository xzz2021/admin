# ===== builder：安装依赖 + prisma generate + nest build =====
FROM node:26.5.0 AS builder

WORKDIR /app

RUN npm i -g pnpm@11.13.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY packages packages/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter server exec prisma generate
RUN pnpm --filter server build

# ===== migrator：一次性执行数据库迁移（复用 builder，含 prisma CLI）=====
FROM builder AS migrator

WORKDIR /app/apps/server

ENV NODE_ENV=production

CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm exec prisma db seed"]

# ===== runner：仅运行 Nest 应用 =====
FROM node:26.5.0-alpine3.24 AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN npm i -g pnpm@11.13.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY packages packages/

RUN pnpm install --prod --frozen-lockfile \
  && chown -R node:node /app

COPY --from=builder --chown=node:node /app/apps/server/dist apps/server/dist
COPY --from=builder --chown=node:node /app/apps/server/public apps/server/public

WORKDIR /app/apps/server

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/src/main.js"]
