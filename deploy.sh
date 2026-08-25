
# ==============================
# 配置
# chmod +x deploy.sh
#./deploy.sh
# ==============================
#!/usr/bin/env bash
set -Eeuo pipefail

REPO="git@github.com:xzz2021/admin.git"
BRANCH="main"
COMPOSE_FILE="compose.yml"

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

echo "========================================"
echo "开始部署"
echo "目录: $APP_DIR"
echo "仓库: $REPO"
echo "分支: $BRANCH"
echo "========================================"

command -v git >/dev/null 2>&1 || {
  echo "错误: 未安装 git"
  exit 1
}

command -v docker >/dev/null 2>&1 || {
  echo "错误: 未安装 docker"
  exit 1
}

# 第一次运行时初始化 Git 仓库
if [ ! -d ".git" ]; then
  echo
  echo "==> 当前目录尚未初始化 Git，开始初始化..."

  git init
  git remote add origin "$REPO"

  echo "==> Git 初始化完成"
else
  # 确保 origin 指向正确仓库
  if git remote get-url origin >/dev/null 2>&1; then
    git remote set-url origin "$REPO"
  else
    git remote add origin "$REPO"
  fi
fi

echo
echo "==> 获取远程最新代码..."

git fetch origin "$BRANCH"

echo "==> 使用远程 $BRANCH 覆盖当前 Git 管理的文件..."

git reset --hard "origin/$BRANCH"

echo
echo "==> 当前代码版本:"
git log -1 --pretty=format:'%h - %s (%ci)'
echo

# reset 后再检查，因为第一次部署前 compose.yml 可能还不存在
if [ ! -f "$COMPOSE_FILE" ]; then
  echo "错误: 仓库中未找到 $COMPOSE_FILE"
  exit 1
fi

echo
echo "==> 开始构建并启动 Docker 服务..."

docker compose -f "$COMPOSE_FILE" up -d --build

echo
echo "==> Docker 服务状态:"
docker compose -f "$COMPOSE_FILE" ps

echo
echo "========================================"
echo "部署完成"
echo "========================================"
