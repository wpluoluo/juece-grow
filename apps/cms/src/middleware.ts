import { NextRequest, NextResponse } from 'next/server'

/** 后台界面默认中文：浏览器为英文环境时，Payload 内置 UI 会跟英文，
 *  与我们写死的中文标签混杂。此中间件在用户未显式选过语言时，
 *  改写后台请求的语言头强制按中文解析，避免中英混杂。 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 仅对后台（admin 页面及其嵌套资源）生效
  if (pathname !== '/admin' && !pathname.startsWith('/admin/')) {
    return NextResponse.next()
  }

  // Payload 会在用户手动切换语言后写入偏好 cookie；
  // 存在偏好时不覆盖，否则默认用中文。
  if (request.cookies.get('payload-lng')?.value) {
    return NextResponse.next()
  }

  // 改写请求自身的 Accept-Language，让 Payload 的语言检测按中文走。
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('accept-language', 'zh-CN')

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}