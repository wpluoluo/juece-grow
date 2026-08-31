#!/bin/bash
# Chatwoot 生产部署脚本（juece-grow，@juece.cloud）
#   1) 镜像缓存优先：固定 tag，仅当本地无该镜像时才拉取，绝不无谓重复 pull
#   2) 部署前自动备份 chatwoot_production，保留最近 2 版
#   3) 数据迁移自动执行（rails db:migrate）
#   4) 任一步失败自动回滚：停容器 -> 从最近备份恢复库 -> 重启 -> 退出非 0
# 用法：bash deploy-chatwoot.sh
set -euo pipefail

APP=/opt/juece-grow/chatwoot
cd "$APP"
# 读取端口等编排变量（.env 由 chatwoot-up.sh 写入）
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

# ---------- 回滚（trap EXIT，仅失败时真正回滚） ----------
rollback(){
  # $1 为本次退出码：0 表示成功，不做任何回滚
  if [ "${1:-1}" -ne 0 ] && [ "$ROLLED_BACK" -eq 0 ]; then
    ROLLED_BACK=1
    log "部署失败，开始自动回滚"
    $COMPOSE stop >/dev/null 2>&1 || true
    LATEST=$(ls -1t "$BK"/chatwoot.*.sql 2>/dev/null | head -1)
    if [ -n "$LATEST" ]; then
      log "停止后回滚数据库 <- $LATEST"
      docker exec -i "$PGCT" sh -c "PGPASSWORD=$PGPASS psql -h 127.0.0.1 -U $PGUSER -d postgres -v ON_ERROR_STOP=1" >/dev/null 2>&1 <<'SQL'
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
 WHERE datname='chatwoot_production' AND pid<>pg_backend_pid();
SQL
      docker exec -i "$PGCT" sh -c "PGPASSWORD=$PGPASS psql -h 127.0.0.1 -U $PGUSER -d postgres -v ON_ERROR_STOP=1 -c 'DROP DATABASE IF EXISTS $DB;' -c 'CREATE DATABASE $DB OWNER \"$PGUSER\";'" >/dev/null
      docker exec -i "$PGCT" sh -c "PGPASSWORD=$PGPASS psql -h 127.0.0.1 -U $PGUSER -d $DB -v ON_ERROR_STOP=1" < "$LATEST"
      log "库已恢复"
    else
      log "警告：无可用备份，跳过库回滚"
    fi
    log "重启容器"
    $COMPOSE up -d 2>&1
    log "回滚完成，退出码非 0 以标识失败"
  fi
}
trap 'RC=$?; rollback "$RC"; exit $RC' EXIT

# ---------- 1) 镜像缓存优先 ----------
if docker image inspect "$IMAGE" >/dev/null 2>&1; then
  log "镜像缓存命中，跳过拉取：$IMAGE"
else
  log "本地无 $IMAGE，开始拉取"
  docker pull "$IMAGE"
fi

# ---------- 2) 部署前备份（保留最近 2 版） ----------
log "部署前备份 $DB"
docker exec "$PGCT" sh -c "PGPASSWORD=$PGPASS pg_dump -h 127.0.0.1 -U $PGUSER -d $DB" > "$BK/chatwoot.$STAMP.sql" 2>"$BK/chatwoot.$STAMP.err"
log "备份完成 -> $(basename "$BK/chatwoot.$STAMP.sql") ($(wc -c < "$BK/chatwoot.$STAMP.sql") bytes)"
# 保留最近 2 版，删除更旧的
ls -1t "$BK"/chatwoot.*.sql 2>/dev/null | tail -n +3 | xargs -r rm -f
log "备份保留策略：$(ls -1 "$BK"/chatwoot.*.sql 2>/dev/null | wc -l) 份当前留存"

# ---------- 3) 启动/重建（固定 tag，不 pull） ----------
log "up -d（固定 tag，无缓存则不主动拉取）"
$COMPOSE up -d 2>&1

# ---------- 4) 数据迁移自动执行 ----------
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

# ---------- 5) 健康检查 ----------
for i in $(seq 1 12); do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$CH_PORT/" 2>/dev/null || echo 000)
  [ "$CODE" != "000" ] && break
  sleep 5
done
log "健康检查 HTTP=$CODE"
[ "$CODE" = "000" ] && { log "服务未就绪，触发回滚"; exit 1; }

log "部署成功：Chatwoot 运行于 http://127.0.0.1:$CH_PORT"
$COMPOSE ps 2>&1