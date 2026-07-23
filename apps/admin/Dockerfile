FROM node:26.5.0 AS builder

WORKDIR /app

RUN npm i -g pnpm@11.13.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/admin/package.json apps/admin/
COPY packages packages/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter admin build:pro


FROM nginx:1.31-alpine

COPY --from=builder /app/apps/admin/dist-pro /usr/share/nginx/html

COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx","-g","daemon off;"]
