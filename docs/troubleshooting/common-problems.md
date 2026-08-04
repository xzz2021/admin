# 常见问题

## 部署网络名称不一致

根 `README.md` 示例创建 `shared`，`compose.yml` 外部网络名为 **`shared_net`**。网络不存在会导致 admin 无法加入外部网络启动失败。按 compose 创建：`docker network create shared_net`。

## 数据库连接变量名

`.env.example` 使用 `APP_DATABASE_URL` / `MIGRATION_DATABASE_URL`；应用与 Prisma 实际读取 **`PG_DATABASE_URL`**。Compose 已做映射；本地直跑 Nest 时请在环境中设置 `PG_DATABASE_URL`。

## /api 404

Nest 未设置全局前缀。请求必须经 Vite 代理或 Nginx 去掉 `/api`。直连 `localhost:3000` 时应访问 `/auth/login` 而非 `/api/auth/login`。

## 登录验证码失败

需携带验证码相关 cookie，且 Redis 可用。检查 `REDIS_HOST/PORT/PASSWORD` 与跨域/同站 cookie 策略（本地代理同域相对路径通常可行）。

## Refresh 后仍掉线

确认 `withCredentials: true`、cookie `rt` 未被清；`TOKEN_REFRESH_SECRET` 与签发时一致；SSO 会话未被踢或黑名单。

## 权限接口 403 但超管

确认角色 `code` 精确为 `super_admin` 且 `enabled`。非超管需角色已绑定对应 Permission，并等待或清除 RBAC Redis 缓存。

## Prisma / Node 版本

Prisma 7 不兼容 Node 26；官方部署镜像使用 Node 24。本地若 migrate/generate 异常，先核对 Node 版本。

## Windows 安装 zod-prisma

workspace 已对 `@hatkom/nestjs-zod-prisma` 设置 `allowBuilds: false`，避免 preinstall 的 Unix `find` 失败。

## 静态资源 / 头像无法访问

核对 `STATIC_FILE_ROOT_PATH`、`STATIC_FILE_SERVE_ROOT`、bind mount `./data/server/public`，以及 Helmet CORP / 反代路径。

## 数据库备份 EACCES permission denied

`public`/`backups` 使用宿主机目录 bind mount。若目录由 Docker 以 root 创建，`node`（uid 1000）无法写入。先在宿主机执行：

```bash
mkdir -p data/server/public data/server/backups
chown -R 1000:1000 data/server
docker compose up -d server
```

## 前端菜单有、页面空白

服务端菜单 `component` 路径需能匹配 `views/**/*.{vue,tsx}` glob；`#`/`##` 仅用于布局节点。

## migrate 容器反复失败

检查 `MIGRATION_DATABASE_URL` 密码 URL 编码、migrator 用户是否由 `init-users.sh` 创建（仅**首次**初始化数据卷生效）。已有卷可参考 `migrate-existing-users.sql` 手动处理。
