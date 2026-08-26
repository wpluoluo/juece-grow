import { NextRequest } from 'next/server'

import { getPayload } from 'payload'
import config from '@payload-config'

import { err, ok } from '../../../../../lib/envelope'

/** Chatwoot 收件 webhook：把客服/网页会话消息写回自有 Postgres 线索池（source=support）。 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const secret = process.env.CHATWOOT_WEBHOOK_SECRET
  if (!secret || token !== secret) return err('UNAUTHORIZED', '无效的 webhook token', 401)

  const projectIdNum = Number(url.searchParams.get('projectId'))
  if (!Number.isInteger(projectIdNum) || projectIdNum <= 0) {
    return err('INVALID_PROJECT', 'projectId 必须是正整数', 400)
  }

  const body = (await req.json().catch(() => null)) as ChatwootEvent | null
  if (!body) return err('INVALID_JSON', '请求体必须是 JSON')

  // 仅处理顾客（Contact）发来的消息事件，其余事件直接确认。
  if (body.event !== 'message_created' || body.message?.sender_type !== 'Contact') {
    return ok({ accepted: false })
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
      return ok({ id: cur.id, duplicate: true })
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
    return ok({ id: lead.id, duplicate: false })
  } catch {
    return err('LEAD_CREATE_FAILED', '线索写入失败，请稍后再试', 500)
  }
}

/** 归一化手机号：去空格/连字符，补 +86 → 13x 开头 11 位；无法归一返回空。 */
function normalizePhone(raw?: string): string {
  const digits = (raw || '').replace(/[\s()-]/g, '')
  if (/^\+?86\d{11}$/.test(digits)) return digits.replace(/^\+?86/, '')
  if (/^\d{11}$/.test(digits)) return digits
  return ''
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