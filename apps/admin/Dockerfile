FROM node:24.18 AS builder

WORKDIR /app

RUN npm i -g pnpm@11.13.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/admin/package.json apps/admin/
COPY packages packages/

# 切换 pnpm 源为镜像源
RUN pnpm config set registry https://registry.npmmirror.com

# 使用 BuildKit 缓存 pnpm store
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile --filter admin...

COPY . .

# 限制 Node 进程的最大内存使用为 2GB（根据你的服务器内存调整，如 1024 / 2048 / 4096）
ENV NODE_OPTIONS="--max-old-space-size=1024"

RUN pnpm --filter admin build:pro

FROM nginx:1.31-alpine

COPY --from=builder /app/apps/admin/dist-pro /usr/share/nginx/html

COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx","-g","daemon off;"]

# -------------------服务器内容太小,手动build再上传-----------

#   # 极简 Dockerfile 示例
# FROM nginx:1.31-alpine
# COPY apps/admin/dist-pro /usr/share/nginx/html
# EXPOSE 80
