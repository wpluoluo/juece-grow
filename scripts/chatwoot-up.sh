#!/bin/bash
# Chatwoot 生产编排预置：把 compose 与 .env 落盘到服务器 /opt/juece-grow/chatwoot。
# 敏感值一律走外部环境变量注入（${VAR:?} 缺则报错），禁止硬编码、不入 git。
set -euo pipefail
APP=/opt/juece-grow/chatwoot
mkdir -p "$APP"
cd "$APP"

# ---------- 必需敏感项（未注入即终止） ----------
: "${PROD_PG_HOST:?请先 export PROD_PG_HOST（如 1Panel-postgresql-ZTyL）}"
: "${PROD_PG_PORT:=5432}"
: "${PROD_PG_USER:?请先 export PROD_PG_USER（如 juece-grow）}"
: "${PROD_PG_PASSWORD:?请先 export PROD_PG_PASSWORD（服务器原生 Postgres 密码）}"
: "${CHATWOOT_REDIS_URL:?请先 export CHATWOOT_REDIS_URL（如 redis://:密码@1Panel-redis-FiQR:6379）}"
: "${CHATWOOT_SECRET_KEY_BASE:?请先 export CHATWOOT_SECRET_KEY_BASE}"
: "${CHATWOOT_FRONTEND_URL:?请先 export CHATWOOT_FRONTEND_URL（如 https://chat.juece.cloud）}"
: "${CHATWOOT_HTTP_PORT:=3300}"

# ---------- .env ----------
cat > .env <<EOF
# Chatwoot 生产编排变量（juece-grow，@juece.cloud）
# PG：服务器原生 1Panel-postgresql-ZTyL / chatwoot_production
# Redis：服务器原生 1Panel-redis-FiQR（1panel-network，需密码）
PROD_PG_HOST=$PROD_PG_HOST
PROD_PG_PORT=$PROD_PG_PORT
PROD_PG_USER=$PROD_PG_USER
PROD_PG_PASSWORD=$PROD_PG_PASSWORD
CHATWOOT_REDIS_URL=$CHATWOOT_REDIS_URL
CHATWOOT_SECRET_KEY_BASE=$CHATWOOT_SECRET_KEY_BASE
CHATWOOT_FRONTEND_URL=$CHATWOOT_FRONTEND_URL
CHATWOOT_HTTP_PORT=$CHATWOOT_HTTP_PORT
EOF
echo "ENV_WRITTEN"; ls -la .env

# ---------- docker-compose.prod.yml（最小，仅加载 compose 编排） ----------
# 由仓库内 docker-compose.prod.yml 提供；此处落一份一致的拷贝。
cat > docker-compose.prod.yml <<'CEOF'
# 生产部署编排：仅承载 Chatwoot 应用进程，DB 与 Redis 一律使用服务器原生服务（不落容器）。
# - PostgreSQL：服务器原生 `1Panel-postgresql-ZTyL`，chatwoot_production 库。
# - Redis：服务器原生 `1Panel-redis-FiQR`（1panel-network，需密码）。
# - 两容器加入外部 1panel-network 以解析上述原生服务。
services:
  chatwoot-web:
    image: chatwoot/chatwoot:latest
    restart: unless-stopped
    networks:
      - chatwoot-net
    entrypoint: /bin/sh -c 'bundle exec rails db:chatwoot_prepare || true && bundle exec rails s -p 3000 -b 0.0.0.0'
    environment:
      POSTGRES_HOST: ${PROD_PG_HOST}
      POSTGRES_PORT: '${PROD_PG_PORT:-5432}'
      POSTGRES_USERNAME: ${PROD_PG_USER}
      POSTGRES_PASSWORD: ${PROD_PG_PASSWORD}
      POSTGRES_DATABASE: chatwoot_production
      REDIS_URL: ${CHATWOOT_REDIS_URL}
      SECRET_KEY_BASE: ${CHATWOOT_SECRET_KEY_BASE}
      RAILS_ENV: production
      NODE_ENV: production
      RAILS_LOG_TO_STDOUT: 'true'
      LOG_LEVEL: info
      FRONTEND_URL: ${CHATWOOT_FRONTEND_URL}
      DEFAULT_LOCALE: zh_CN
      ENABLE_ACCOUNT_SIGNUP: 'false'
    ports:
      - '127.0.0.1:${CHATWOOT_HTTP_PORT:-3300}:3000'

  chatwoot-sidekiq:
    image: chatwoot/chatwoot:latest
    restart: unless-stopped
    networks:
      - chatwoot-net
    command: bundle exec sidekiq -C config/sidekiq.yml
    environment:
      POSTGRES_HOST: ${PROD_PG_HOST}
      POSTGRES_PORT: '${PROD_PG_PORT:-5432}'
      POSTGRES_USERNAME: ${PROD_PG_USER}
      POSTGRES_PASSWORD: ${PROD_PG_PASSWORD}
      POSTGRES_DATABASE: chatwoot_production
      REDIS_URL: ${CHATWOOT_REDIS_URL}
      SECRET_KEY_BASE: ${CHATWOOT_SECRET_KEY_BASE}
      RAILS_ENV: production
      NODE_ENV: production
      RAILS_LOG_TO_STDOUT: 'true'
      LOG_LEVEL: info
      FRONTEND_URL: ${CHATWOOT_FRONTEND_URL}

networks:
  chatwoot-net:
    name: 1panel-network
    external: true
CEOF
echo "COMPOSE_WRITTEN"

echo "=== docker compose config check ==="
docker compose -f docker-compose.prod.yml config --quiet && echo "CONFIG_OK" || echo "CONFIG_FAIL"