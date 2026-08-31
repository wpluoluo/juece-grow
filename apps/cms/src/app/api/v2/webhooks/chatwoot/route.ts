import { NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'

import { getPayload } from 'payload'
import config from '@payload-config'

import { err, ok } from '../../../../../lib/envelope'

/** 签名时间戳允许的最大偏差（秒）：防旧请求重放。 */
const SIGNATURE_TTL_SECONDS = 300

/** Chatwoot 收件 webhook：把客服/网页会话消息写回自有 Postgres 线索池（source=support）。 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url)

  // 鉴权走 Chatwoot 官方签名校验：X-Chatwoot-Timestamp + X-Chatwoot-Signature(HMAC-SHA256)。
  const rawBody = await req.text()
  const secret = process.env.CHATWOOT_WEBHOOK_SECRET
  if (!secret || !verifySignature(req.headers, rawBody, secret)) {
    return err('UNAUTHORIZED', '无效的 webhook 签名', 401, req)
  }

  const projectIdNum = Number(url.searchParams.get('projectId'))
  if (!Number.isInteger(projectIdNum) || projectIdNum <= 0) {
    return err('INVALID_PROJECT', 'projectId 必须是正整数', 400, req)
  }

  const body = (parseJson(rawBody) as ChatwootEvent | null) ?? null
  if (!body) return err('INVALID_JSON', '请求体必须是 JSON', 400, req)

  // 仅处理顾客（Contact）发来的消息事件，其余事件直接确认。
  if (body.event !== 'message_created' || body.message?.sender_type !== 'Contact') {
    return ok({ accepted: false }, req)
  }

  try {
    const payload = await getPayload({ config })
    const sender = body.message.sender
    const content = (body.message.content || '').trim().slice(0, 500)
    const name = (sender?.name || '').trim().slice(0, 50)

    // 去重键：优先联系邮箱/手机，其次按会话隔离（每个会话一条）。
    const email = (sender?.email || '').trim()
    const phone = normalizePhone(sender?.phone_number)
    const dedupKey = email || phone || `chatwoot:${body.conversation.id}`

    const existing = await payload.find({
      collection: 'leads',
      overrideAccess: true,
      where: { and: [{ project: { equals: projectIdNum } }, { dedupKey: { equals: dedupKey } }] },
      limit: 1,
      depth: 0,
    })

    if (existing.docs.length > 0) {
      const cur = existing.docs[0]
      const patch: Record<string, unknown> = {}
      if (!cur.name && name) patch.name = name
      if (!cur.phone && phone) patch.phone = phone
      if (!cur.note && content) patch.note = content
      const followUpNote = [cur.followUpNote, content].filter(Boolean).join('\n')
      if (followUpNote && followUpNote !== cur.followUpNote) patch.followUpNote = followUpNote
      if (Object.keys(patch).length > 0) {
        await payload.update({ collection: 'leads', overrideAccess: true, id: cur.id, data: patch })
      }
      return ok({ id: cur.id, duplicate: true }, req)
    }

    const lead = await payload.create({
      collection: 'leads',
      overrideAccess: true,
      data: {
        project: projectIdNum,
        name,
        phone,
        note: content,
        source: 'support',
        dedupKey,
        status: 'new',
      },
    })
    return ok({ id: lead.id, duplicate: false }, req)
  } catch {
    return err('LEAD_CREATE_FAILED', '线索写入失败，请稍后再试', 500, req)
  }
}

/** 归一化手机号：去空格/连字符，补 +86 → 13x 开头 11 位；无法归一返回空。 */
function normalizePhone(raw?: string): string {
  const digits = (raw || '').replace(/[\s()-]/g, '')
  if (/^\+?86\d{11}$/.test(digits)) return digits.replace(/^\+?86/, '')
  if (/^\d{11}$/.test(digits)) return digits
  return ''
}

/** 校验 Chatwoot 官方签名：X-Chatwoot-Timestamp + X-Chatwoot-Signature=sha256=HMAC(secret, "{ts}.{body}")。 */
function verifySignature(headers: Headers, rawBody: string, secret: string): boolean {
  const tsHeader = headers.get('x-chatwoot-timestamp')
  const sigHeader = headers.get('x-chatwoot-signature')
  if (!tsHeader || !sigHeader) return false

  const ts = Number(tsHeader)
  if (!Number.isInteger(ts)) return false
  // 防重放：时间戳超出波动窗口则拒绝。
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > SIGNATURE_TTL_SECONDS) return false

  const expected = createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex')
  const provided = sigHeader.startsWith('sha256=') ? sigHeader.slice('sha256='.length) : null
  if (!provided || expected.length !== provided.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
}

/** 安全解析 JSON，失败返回 null。 */
function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

type ChatwootEvent = {
  event?: string
  conversation: { id: number }
  message?: {
    content?: string
    sender_type?: string
    sender?: { name?: string; email?: string; phone_number?: string }
  }
}

export { OPTIONS } from '../../../../../lib/envelope'