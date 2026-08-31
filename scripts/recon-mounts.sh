#!/bin/bash
# Chatwoot webhook 联调冒烟脚本（统一走 Chatwoot 官方签名 X-Chatwoot-Timestamp + X-Chatwoot-Signature）。
set -e
SECRET=$(docker exec juece-grow-cms sh -c 'echo $CHATWOOT_WEBHOOK_SECRET')
if [ -z "$SECRET" ]; then
  echo "未获取到 CHATWOOT_WEBHOOK_SECRET，终止"
  exit 1
fi
# 生成 Chatwoot 官方签名：sha256=HMAC-SHA256(secret, "{ts}.{body}")
sign() {
  local ts=$1 body=$2
  # openssl -r 输出 "<hex> *stdin"，取第一个字段即签名 hex，无需 xxd。
  local hex
  hex=$(printf '%s' "${ts}.${body}" | openssl dgst -sha256 -hmac "$SECRET" -r | awk '{print $1}')
  printf 'sha256=%s' "$hex"
}

BODY1='{"event":"message_created","conversation":{"id":9001},"message":{"content":"冒烟：客服会话消息","sender_type":"Contact","sender":{"name":"客服访客","phone_number":"13800138000"}}}'
BODY2='{"event":"agent_message_created","conversation":{"id":9002}}'
BODY3='{"event":"message_created","conversation":{"id":9003}}'
TS=$(date +%s)

echo "=== webhook with valid signature (message_created/Contact) ==="
curl -s -o /tmp/w.json -w "http=%{http_code}\n" --max-time 20 -X POST \
  "https://juece.cloud/api/v2/webhooks/chatwoot?projectId=1" \
  -H "Content-Type: application/json" \
  -H "x-chatwoot-timestamp: $TS" \
  -H "x-chatwoot-signature: $(sign "$TS" "$BODY1")" \
  --data-binary "$BODY1"
head -c 300 /tmp/w.json; echo
echo "=== webhook with valid signature but non-Contact event (accepted:false) ==="
TS=$(date +%s)
curl -s -o /tmp/w2.json -w "http=%{http_code}\n" --max-time 20 -X POST \
  "https://juece.cloud/api/v2/webhooks/chatwoot?projectId=1" \
  -H "Content-Type: application/json" \
  -H "x-chatwoot-timestamp: $TS" \
  -H "x-chatwoot-signature: $(sign "$TS" "$BODY2")" \
  --data-binary "$BODY2"
head -c 300 /tmp/w2.json; echo
echo "=== webhook wrong signature (expect 401) ==="
TS=$(date +%s)
curl -s -o /tmp/w3.json -w "http=%{http_code}\n" --max-time 15 -X POST \
  "https://juece.cloud/api/v2/webhooks/chatwoot?projectId=1" \
  -H "Content-Type: application/json" \
  -H "x-chatwoot-timestamp: $TS" \
  -H "x-chatwoot-signature: sha256=$(printf '0%.0s' $(seq 64))" \
  --data-binary "$BODY3"
head -c 150 /tmp/w3.json; echo