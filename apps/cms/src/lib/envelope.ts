import { NextResponse } from 'next/server'

/** Phase 1 开发期允许 Astro 公开站跨源调用。 */
export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

/** 统一成功信封：{ success: true, data }。 */
export function ok(data: unknown) {
  return NextResponse.json({ success: true, data }, { headers: corsHeaders() })
}

/** 统一失败信封：{ success: false, error: { code, message } }。 */
export function err(code: string, message: string, status = 400) {
  return NextResponse.json({ success: false, error: { code, message } }, { status, headers: corsHeaders() })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}