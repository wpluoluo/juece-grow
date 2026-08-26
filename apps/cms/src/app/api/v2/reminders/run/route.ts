import { NextRequest } from 'next/server'

import { getPayload } from 'payload'
import config from '@payload-config'

import { err, ok } from '../../../../../lib/envelope'
import { isGlobalAdmin } from '../../../../../access'
import { runReminderScan } from '../../../../../lib/reminderCron'

/** 手动触发一次提醒扫描（仅全局管理员）。与 cron 共用 runReminderScan 单一实现路径。 */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !isGlobalAdmin(user)) {
      return err('FORBIDDEN', '仅管理员可手动触发提醒扫描', 403)
    }

    const result = await runReminderScan(payload)
    return ok(result)
  } catch {
    return err('REMINDER_SCAN_FAILED', '提醒扫描失败，请稍后再试', 500)
  }
}