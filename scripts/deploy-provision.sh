#!/bin/bash
# 把仓库内 docker-compose.prod.yml 与 deploy-chatwoot.sh 落盘到服务器并执行部署
set -euo pipefail
APP=/opt/juece-grow/chatwoot
mkdir -p "$APP"

# 写入 compose（含 127.0.0.1 绑定）
cat > "$APP/docker-compose.prod.yml" <<'CEOF'
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

# 写入部署脚本
cat > "$APP/deploy-chatwoot.sh" <<'DEOF'
#!/bin/bash
set -euo pipefail
APP=/opt/juece-grow/chatwoot
cd "$APP"
set +u
. ./.env
set -u
STAMP=$(date +%Y%m%d%H%M%S)
BK=/opt/juece-grow/backups/chatwoot
IMAGE=chatwoot/chatwoot:latest
DB=chatwoot_production
PGCT=1Panel-postgresql-ZTyL
PGUSER=juece-grow
PGPASS=${PROD_PG_PASSWORD:-}
CH_PORT=${CHATWOOT_HTTP_PORT:-3300}
COMPOSE="docker compose -f docker-compose.prod.yml"
ROLLED_BACK=0
mkdir -p "$BK"
log(){ echo "[deploy $(date +%H:%M:%S)] $*"; }
rollback(){
  if [ "${1:-1}" -ne 0 ] && [ "$ROLLED_BACK" -eq 0 ]; then
    ROLLED_BACK=1
    log "部署失败，开始自动回滚"
    $COMPOSE stop >/dev/null 2>&1 || true
    LATEST=$(ls -1 "$BK"/chatwoot.*.sql 2>/dev/null | sort | tail -1)
    if [ -n "$LATEST" ]; then
      log "停止后回滚数据库 <- $LATEST"
      docker exec -i "$PGCT" sh -c "PGPASSWORD=$PGPASS psql -h 127.0.0.1 -U $PGUSER -d postgres" >/dev/null 2>&1 <<'SQL'
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
 WHERE datname='chatwoot_production' AND pid<>pg_backend_pid();
SQL
      docker exec -i "$PGCT" sh -c "PGPASSWORD=$PGPASS psql -h 127.0.0.1 -U $PGUSER -d postgres -c 'DROP DATABASE IF EXISTS $DB;' -c 'CREATE DATABASE $DB OWNER \"$PGUSER\";'" >/dev/null
      docker exec -i "$PGCT" sh -c "PGPASSWORD=$PGPASS psql -h 127.0.0.1 -U $PGUSER -d $DB" < "$LATEST"
      log "库已恢复"
    else
      log "警告：无可用备份，跳过库回滚"
    fi
    log "重启容器"
    $COMPOSE up -d 2>&1
    log "回滚完成"
  fi
}
trap 'RC=$?; rollback "$RC"; exit $RC' EXIT
if docker image inspect "$IMAGE" >/dev/null 2>&1; then
  log "镜像缓存命中，跳过拉取：$IMAGE"
else
  log "本地无 $IMAGE，开始拉取"
  docker pull "$IMAGE"
fi
log "部署前备份 $DB"
docker exec "$PGCT" sh -c "PGPASSWORD=$PGPASS pg_dump -h 127.0.0.1 -U $PGUSER -d $DB" > "$BK/chatwoot.$STAMP.sql" 2>"$BK/chatwoot.$STAMP.err"
log "备份完成 -> $(basename "$BK/chatwoot.$STAMP.sql") ($(wc -c < "$BK/chatwoot.$STAMP.sql") bytes)"
ls -1 "$BK"/chatwoot.*.sql 2>/dev/null | sort | head -n -2 | xargs -r rm -f
log "备份留存 $(ls -1 "$BK"/chatwoot.*.sql 2>/dev/null | wc -l) 份"
log "up -d（固定 tag，无缓存则不主动拉取）"
$COMPOSE up -d 2>&1
log "等待 web 就绪"
for i in $(seq 1 30); do
  if curl -sf -o /dev/null --max-time 3 "http://127.0.0.1:$CH_PORT/" 2>/dev/null; then
    break
  fi
  sleep 5
done
log "执行数据迁移 rails db:migrate"
$COMPOSE exec -T chatwoot-web bundle exec rails db:migrate 2>&1
log "迁移执行成功"
for i in $(seq 1 12); do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$CH_PORT/" 2>/dev/null || echo 000)
  [ "$CODE" != "000" ] && break
  sleep 5
done
log "健康检查 HTTP=$CODE"
[ "$CODE" = "000" ] && { log "服务未就绪，触发回滚"; exit 1; }
log "部署成功：Chatwoot 运行于 http://127.0.0.1:$CH_PORT"
$COMPOSE ps 2>&1
DEOF
chmod +x "$APP/deploy-chatwoot.sh"
echo "DEPLOY_SCRIPT_WRITTEN"

# 执行
bash "$APP/deploy-chatwoot.sh"