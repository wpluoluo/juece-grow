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

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as LeadInput | null
  if (!body) return err('INVALID_JSON', '请求体必须是 JSON')

  const { projectId, name = '', phone = '', wechat = '', note = '', source } = body

  const projectIdNum = Number(projectId)
  if (!Number.isInteger(projectIdNum) || projectIdNum <= 0) {
    return err('MISSING_PROJECT', '缺少有效的 projectId')
  }

  if (!phone && !wechat) return err('VALIDATION', 'phone 与 wechat 至少填一个')

  const dedupKey = phone || wechat

  try {
    const payload = await getPayload({ config })
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

    return ok({ id: lead.id })
  } catch {
    return err('LEAD_CREATE_FAILED', '线索写入失败，请稍后再试', 500)
  }
}

export { OPTIONS } from '../../../../lib/envelope'