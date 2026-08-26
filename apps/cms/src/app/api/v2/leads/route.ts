import { NextRequest } from 'next/server'

import { getPayload } from 'payload'
import config from '@payload-config'

import { err, ok } from '../../../../lib/envelope'

type LeadInput = {
  projectId: string
  name?: string
  phone?: string
  wechat?: string
  note?: string
  source?: string
}

/** 中国大陆手机号：1 开头 11 位数字。 */
const PHONE_RE = /^1[3-9]\d{9}$/
/** 微信号：6~20 位字母数字，可含下划线/连字符。 */
const WECHAT_RE = /^[A-Za-z0-9_-]{6,20}$/

/** 校验 name 长度与来源取值，返回错误信息；合法返回空。 */
function validateBody(data: {
  name?: string
  phone?: string
  wechat?: string
  note?: string
  source?: string
}): string {
  if (data.name && data.name.trim().length > 50) return '称呼请控制在 50 字以内'
  if (data.note && data.note.trim().length > 500) return '留言请控制在 500 字以内'
  if (data.source && !/^[a-z0-9-]{1,30}$/.test(data.source)) return '来源格式不正确'
  return ''
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as LeadInput | null
  if (!body) return err('INVALID_JSON', '请求体必须是 JSON')

  const projectIdNum = Number(body.projectId)
  if (!Number.isInteger(projectIdNum) || projectIdNum <= 0) {
    return err('MISSING_PROJECT', '缺少有效的 projectId')
  }

  const name = (body.name || '').trim()
  const phone = (body.phone || '').trim()
  const wechat = (body.wechat || '').trim()
  const note = (body.note || '').trim()
  const source = body.source || 'website'

  if (!phone && !wechat) return err('VALIDATION', 'phone 与 wechat 至少填一个')
  if (phone && !PHONE_RE.test(phone)) return err('VALIDATION', '手机号格式不正确')
  if (wechat && !WECHAT_RE.test(wechat)) return err('VALIDATION', '微信号格式不正确（6~20 位字母数字）')

  const fieldError = validateBody({ name, phone, wechat, note, source })
  if (fieldError) return err('VALIDATION', fieldError)

  try {
    const payload = await getPayload({ config })

    // 校验 project 真实存在，避免写入孤儿线索。
    const project = await payload.find({
      collection: 'projects',
      overrideAccess: true,
      where: { id: { equals: projectIdNum } },
      limit: 1,
      depth: 0,
    })
    if (project.docs.length === 0) return err('PROJECT_NOT_FOUND', '项目不存在')

    // 去重：同一项目下相同 dedupKey 的线索跳过写入，避免重复留资。
    const dedupKey = phone || wechat
    if (dedupKey) {
      const existing = await payload.find({
        collection: 'leads',
        overrideAccess: true,
        where: {
          and: [{ project: { equals: projectIdNum } }, { dedupKey: { equals: dedupKey } }],
        },
        limit: 1,
        depth: 0,
      })
      if (existing.docs.length > 0) {
        return ok({ id: existing.docs[0].id, duplicate: true })
      }
    }

    const lead = await payload.create({
      collection: 'leads',
      overrideAccess: true,
      data: {
        project: projectIdNum,
        name,
        phone,
        wechat,
        note,
        source,
        dedupKey,
        status: 'new',
      },
    })

    return ok({ id: lead.id, duplicate: false })
  } catch {
    return err('LEAD_CREATE_FAILED', '线索写入失败，请稍后再试', 500)
  }
}

export { OPTIONS } from '../../../../lib/envelope'