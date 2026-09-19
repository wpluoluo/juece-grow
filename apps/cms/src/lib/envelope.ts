import { NextRequest, NextResponse } from 'next/server'

/**
 * 公开 API (v2) 的 CORS 来源白名单：唯一来源是 process.env.PUBLIC_CORS_ORIGINS（逗号分隔），无内置默认。
 * 变量缺失或 trim 后为空集合即抛错——宁可拒绝服务，也不用兜底白名单放行跨端请求。
 * 仅当请求 Origin 命中白名单才回 `Access-Control-Allow-Origin`，非白名单 Origin 不出 CORS 头（跨端投毒被拒）。
 */
function allowedOrigin(origin: string | null | undefined): string | null {
  const list = (process.env.PUBLIC_CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  if (list.length === 0) {
    throw new Error(
      'PUBLIC_CORS_ORIGINS 未配置或为空：CORS 白名单无内置默认，须以逗号分隔注入公开站 origin'
        + '（如 https://juece.cloud,https://erp.juece.cloud,https://yunque.juece.cloud）',
    )
  }
  if (!origin) return null
  if (list.includes(origin)) return origin
  return null
}

/** 按请求 Origin 生成 CORS 响应头；未命中白名单则不出 Allow-Origin。 */
export function corsHeaders(req?: NextRequest, isPreflight = false): Record<string, string> {
  const origin = req?.headers.get('origin')
  const allow = allowedOrigin(origin)
  const h: Record<string, string> = {}
  if (allow) {
    h['Access-Control-Allow-Origin'] = allow
    h['Vary'] = 'Origin'
  }
  if (isPreflight && allow) {
    h['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    h['Access-Control-Allow-Headers'] = 'Content-Type'
  }
  return h
}

/** 统一成功信封：{ success: true, data }。 */
export function ok(data: unknown, req?: NextRequest) {
  return NextResponse.json({ success: true, data }, { headers: corsHeaders(req) })
}

/** 统一失败信封：{ success: false, error: { code, message } }。 */
export function err(code: string, message: string, status = 400, req?: NextRequest) {
  return NextResponse.json({ success: false, error: { code, message } }, { status, headers: corsHeaders(req) })
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req, true) })
}