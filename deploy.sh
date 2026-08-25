#!/usr/bin/env bash
set -Eeuo pipefail

# ==============================
# 配置
# chmod +x deploy.sh
#./deploy.sh
# ==============================
BRANCH="main"
COMPOSE_FILE="compose.yml"

# 脚本所在目录，即 admin 目录
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$APP_DIR"

echo "========================================"
echo "开始部署"
echo "目录: $APP_DIR"
echo "分支: $BRANCH"
echo "========================================"

# ==============================
# 1. 检查必要命令
# ==============================
command -v git >/dev/null 2>&1 || {
  echo "错误: 未安装 git"
  exit 1
}

command -v docker >/dev/null 2>&1 || {
  echo "错误: 未安装 docker"
  exit 1
}

# ==============================
# 2. 检查当前目录是否为 Git 仓库
# ==============================
if [ ! -d ".git" ]; then
  echo "错误: $APP_DIR 不是 Git 仓库"
  exit 1
fi

# ==============================
# 3. 检查 compose.yml
# ==============================
if [ ! -f "$COMPOSE_FILE" ]; then
  echo "错误: 未找到 $COMPOSE_FILE"
  exit 1
fi

# ==============================
# 4. 拉取远程最新代码
# ==============================
echo
echo "==> 正在获取远程代码..."

git fetch origin "$BRANCH"

echo "==> 正在同步到 origin/$BRANCH..."

git reset --hard "origin/$BRANCH"

echo "==> 当前版本:"
git log -1 --pretty=format:'%h - %s (%ci)'
echo

# ==============================
# 5. Docker Compose 构建并启动
# ==============================
echo
echo "==> 开始构建并启动 Docker 服务..."

docker compose -f "$COMPOSE_FILE" up -d --build

# ==============================
# 6. 查看运行状态
# ==============================
echo
echo "==> Docker 服务状态:"
docker compose -f "$COMPOSE_FILE" ps

echo
echo "========================================"
echo "部署完成"
echo "========================================"
