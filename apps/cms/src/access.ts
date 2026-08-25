import type { Access } from 'payload'

/** 已登录用户（后台/内网接口）。 */
export const authenticated: Access = ({ req: { user } }) => Boolean(user)

/** 任何人（公开内容读取 / 公开注册 / 公开线索写入）。 */
export const everyone: Access = () => true