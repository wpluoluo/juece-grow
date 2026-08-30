import { NextRequest, NextResponse } from 'next/server'

/**
 * 公开 API (v2) 的 CORS 来源白名单。缺失环境变量时启用内置默认（三个公开站 + 本地开发）。
 * 仅当请求 Origin 命中白名单才回 `Access-Control-Allow-Origin`，非白名单 Origin 不出 CORS 头（跨端投毒被拒）。
 */
const DEFAULT_CORS_ORIGINS = [
  'https://juece.cloud',
  'https://erp.juece.cloud',
  'https://yunque.juece.cloud',
  'http://localhost:4321',
  'http://127.0.0.1:4321',
]

function allowedOrigin(origin: string | null | undefined): string | null {
  if (!origin) return null
  const list = (process.env.PUBLIC_CORS_ORIGINS ? process.env.PUBLIC_CORS_ORIGINS.split(',') : DEFAULT_CORS_ORIGINS).map((s) =>
    s.trim(),
  )
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