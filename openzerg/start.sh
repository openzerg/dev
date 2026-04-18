#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_DIR="$SCRIPT_DIR/compose"
ENV_FILE="$COMPOSE_DIR/.env"

usage() {
  echo "Usage: $0 <command>"
  echo ""
  echo "Commands:"
  echo "  setup     初始化 .env 配置（首次部署）"
  echo "  start     启动所有服务"
  echo "  stop      停止所有服务"
  echo "  restart   重启所有服务"
  echo "  status    服务健康状态"
  echo "  logs      查看日志（可选参数：服务名，如 creep）"
  echo "  build     构建 creep 镜像"
  echo "  shell     进入 PostgreSQL 命令行"
  echo ""
  echo "示例："
  echo "  $0 setup"
  echo "  $0 start"
  echo "  $0 logs creep"
  echo "  $0 shell"
}

require_env() {
  if [ ! -f "$ENV_FILE" ]; then
    echo "错误：未找到 $ENV_FILE"
    echo "运行 '$0 setup' 创建配置文件"
    exit 1
  fi
}

cmd_setup() {
  if [ -f "$ENV_FILE" ]; then
    echo ".env 已存在，跳过（手动编辑以修改）：$ENV_FILE"
    exit 0
  fi
  cp "$COMPOSE_DIR/.env.example" "$ENV_FILE"

  # 生成随机密码
  local password
  password=$(head -c 16 /dev/urandom | od -A n -t x1 | tr -d ' \n' | head -c 32)
  sed -i "s/POSTGRES_PASSWORD=changeme/POSTGRES_PASSWORD=${password}/" "$ENV_FILE"

  echo "已生成配置：$ENV_FILE"
  echo "PostgreSQL 密码: ${password}"
}

cmd_start() {
  require_env
  echo "启动服务..."
  podman compose -f "$COMPOSE_DIR/compose.yaml" --env-file "$ENV_FILE" up -d
  echo "等待 PostgreSQL 健康..."
  sleep 3
  podman compose -f "$COMPOSE_DIR/compose.yaml" --env-file "$ENV_FILE" ps
}

cmd_stop() {
  require_env
  podman compose -f "$COMPOSE_DIR/compose.yaml" --env-file "$ENV_FILE" down
}

cmd_restart() {
  cmd_stop
  cmd_start
}

cmd_status() {
  require_env
  podman compose -f "$COMPOSE_DIR/compose.yaml" --env-file "$ENV_FILE" ps
}

cmd_logs() {
  require_env
  local service="${1:-}"
  if [ -n "$service" ]; then
    podman compose -f "$COMPOSE_DIR/compose.yaml" --env-file "$ENV_FILE" logs -f "$service"
  else
    podman compose -f "$COMPOSE_DIR/compose.yaml" --env-file "$ENV_FILE" logs -f
  fi
}

cmd_build() {
  require_env
  echo "构建 creep 镜像..."
  podman compose -f "$COMPOSE_DIR/compose.yaml" --env-file "$ENV_FILE" build creep
}

cmd_shell() {
  require_env
  source "$ENV_FILE"
  podman exec -it uz-postgres psql -U "${POSTGRES_USER:-openzerg}" -d "${POSTGRES_DB:-openzerg}"
}

case "${1:-}" in
  setup)   cmd_setup ;;
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  restart) cmd_restart ;;
  status)  cmd_status ;;
  logs)    cmd_logs "${2:-}" ;;
  build)   cmd_build ;;
  shell)   cmd_shell ;;
  *)       usage ;;
esac
