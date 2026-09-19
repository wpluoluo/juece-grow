#!/bin/bash
# CMS 生产容器启动（juece-grow-cms）。敏感配置走外部环境注入（${VAR:?} 缺则报错），不硬编码、不入 git。
set -euo pipefail

# ---------- 必需敏感项（未注入即终止） ----------
: "${PROD_DATABASE_URI:?请先 export PROD_DATABASE_URI（如 postgres://juece-grow:密码@1Panel-postgresql-ZTyL:5432/juece-grow）}"
: "${PAYLOAD_SECRET:?请先 export PAYLOAD_SECRET}"
: "${NEXT_PUBLIC_SERVER_URL:=https://juece.cloud}"
: "${CHATWOOT_WEBHOOK_SECRET:?请先 export CHATWOOT_WEBHOOK_SECRET}"
# CORS 白名单无内置默认：未注入即在 docker run 之前终止（进程内是首个 /api/v2/* 请求抛错，不是启动期）。
: "${PUBLIC_CORS_ORIGINS:?请先 export PUBLIC_CORS_ORIGINS（逗号分隔的公开站 origin，可直接复制：https://juece.cloud,https://erp.juece.cloud,https://yunque.juece.cloud）}"

# 写入生产 env（不进 git，仅服务器本机）
cat > /opt/juece-grow/cms.env <<EOF
DATABASE_URI=$PROD_DATABASE_URI
PAYLOAD_SECRET=$PAYLOAD_SECRET
NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL
CHATWOOT_WEBHOOK_SECRET=$CHATWOOT_WEBHOOK_SECRET
PUBLIC_CORS_ORIGINS=$PUBLIC_CORS_ORIGINS
EOF
chmod 600 /opt/juece-grow/cms.env

# 先删除旧容器（若存在）
docker rm -f juece-grow-cms 2>/dev/null || true

docker run -d --name juece-grow-cms \
  --restart unless-stopped \
  --network 1panel-network \
  -p 127.0.0.1:3100:3000 \
  --env-file /opt/juece-grow/cms.env \
  juece-grow-cms:latest

echo "容器已启动，等待初始化..."
sleep 12
echo "=== 容器状态 ==="
docker ps --filter "name=juece-grow-cms" --format '{{.Names}}\t{{.Status}}\t{{.Ports}}'
echo "=== 容器日志(近40行) ==="
docker logs --tail 40 juece-grow-cms 2>&1 || true