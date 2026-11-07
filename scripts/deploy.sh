#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
DEPLOY_HOST=${DEPLOY_HOST:-182.92.113.159}
DEPLOY_USER=${DEPLOY_USER:-root}
DEPLOY_SSH_KEY=${DEPLOY_SSH_KEY:-$HOME/.ssh/table-top-deploy-v2}
DEPLOY_DIR=${DEPLOY_DIR:-/srv/table-top}
IMAGE_NAME=${IMAGE_NAME:-table-top-app}
IMAGE_TAG=${IMAGE_TAG:-1.0.0}
MYSQL_IMAGE=${MYSQL_IMAGE:-mysql:8.4}
APP_URL=${APP_URL:-http://$DEPLOY_HOST}
MIGRATE_SQLITE=${MIGRATE_SQLITE:-0}
LEGACY_DB=${LEGACY_DB:-$ROOT_DIR/data/table-top.db}

if [[ ! $DEPLOY_DIR =~ ^/[A-Za-z0-9._/-]+$ ]]; then
  echo "错误：DEPLOY_DIR 必须是不含空格的绝对路径" >&2
  exit 1
fi
if [[ ! -f $DEPLOY_SSH_KEY ]]; then
  echo "错误：部署密钥不存在：$DEPLOY_SSH_KEY" >&2
  exit 1
fi

REMOTE="$DEPLOY_USER@$DEPLOY_HOST"
SSH=(ssh -i "$DEPLOY_SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$REMOTE")
SCP=(scp -i "$DEPLOY_SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)

"${SSH[@]}" 'docker --version >/dev/null && docker compose version >/dev/null'

if ! docker image inspect "$IMAGE_NAME:$IMAGE_TAG" >/dev/null 2>&1; then
  IMAGE_NAME="$IMAGE_NAME" IMAGE_TAG="$IMAGE_TAG" "$ROOT_DIR/scripts/build.sh"
fi

"${SSH[@]}" "mkdir -p '$DEPLOY_DIR/mysql' '$DEPLOY_DIR/data' && chmod 700 '$DEPLOY_DIR'"
"${SCP[@]}" "$ROOT_DIR/deploy/compose.yaml" "$REMOTE:$DEPLOY_DIR/compose.yaml"
if [[ $MIGRATE_SQLITE == 1 ]]; then
  if [[ ! -f $LEGACY_DB ]]; then
    echo "错误：旧数据库不存在：$LEGACY_DB" >&2
    exit 1
  fi
  "${SCP[@]}" "$LEGACY_DB" "$REMOTE:$DEPLOY_DIR/data/table-top.db"
fi

docker save "$IMAGE_NAME:$IMAGE_TAG" | gzip | "${SSH[@]}" 'gunzip | docker load'
if ! "${SSH[@]}" "docker image inspect '$MYSQL_IMAGE' >/dev/null 2>&1"; then
  if ! docker image inspect "$MYSQL_IMAGE" >/dev/null 2>&1; then
    docker pull "$MYSQL_IMAGE"
  fi
  docker save "$MYSQL_IMAGE" | gzip | "${SSH[@]}" 'gunzip | docker load'
fi

"${SSH[@]}" "set -e; cd '$DEPLOY_DIR'; \
  if [ ! -f .env ]; then \
    umask 077; \
    { \
      printf '%s\n' 'MYSQL_DATABASE=table_top' 'MYSQL_USER=table_top'; \
      printf 'MYSQL_PASSWORD=%s\n' \"\$(openssl rand -hex 24)\"; \
      printf 'MYSQL_ROOT_PASSWORD=%s\n' \"\$(openssl rand -hex 32)\"; \
      printf 'AUTH_SECRET=%s\n' \"\$(openssl rand -hex 48)\"; \
    } > .env; \
  fi; \
  if ! grep -q '^MYSQL_DATABASE=' .env; then \
    if [ '$DEPLOY_DIR' = '/srv/kaiju' ]; then printf '%s\n' 'MYSQL_DATABASE=kaiju' >> .env; \
    else printf '%s\n' 'MYSQL_DATABASE=table_top' >> .env; fi; \
  fi; \
  sed -i '/^SQLITE_IMPORT_PATH=/d' .env; \
  chmod 600 .env; \
  export DEPLOY_DIR='$DEPLOY_DIR' DEPLOY_IMAGE_TAG='$IMAGE_TAG'; \
  if [ '$MIGRATE_SQLITE' = '1' ]; then \
    docker compose up -d mysql; \
    docker compose stop app >/dev/null 2>&1 || true; \
    timeout 60 docker compose run --rm --name table-top-migration \
      -e SQLITE_IMPORT_PATH=/tmp/table-top.db --entrypoint sh app \
      -c 'cp /app/legacy/table-top.db /tmp/table-top.db && exec java -jar /app/app.jar' \
      > /tmp/table-top-migration.log 2>&1 || true; \
  fi; \
  docker compose up -d; \
  for i in \$(seq 1 60); do curl -fsS http://127.0.0.1/api/health >/dev/null 2>&1 && break; sleep 1; done; \
  curl -fsS http://127.0.0.1/api/health >/dev/null; \
  if [ '$MIGRATE_SQLITE' = '1' ]; then \
    curl -fsS http://127.0.0.1/api/state > /tmp/table-top-state.json; \
    if ! python3 -c \"import json; s=json.load(open('/tmp/table-top-state.json')); assert len(s['users']) > 0, '未恢复到任何用户'\"; then \
      cat /tmp/table-top-migration.log; exit 1; \
    fi; \
    rm -f /tmp/table-top-state.json /tmp/table-top-migration.log; \
  fi; \
  docker compose ps"

curl --connect-timeout 10 --max-time 20 -fsS "$APP_URL/api/health" >/dev/null
echo "部署完成：$APP_URL"
