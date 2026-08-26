import type { Access, PayloadRequest } from 'payload'

/** 已登录用户（后台/内网接口）。 */
export const authenticated: Access = ({ req: { user } }) => Boolean(user)

/** 任何人（公开内容读取 / 公开注册 / 公开线索写入）。 */
export const everyone: Access = () => true

/** 全局管理员：登录用户的全局 role 为 admin（跨项目全权）。 */
export const isGlobalAdmin = (user?: unknown): boolean => Boolean(user && (user as { role?: string }).role === 'admin')

/** 查当前用户在各 Membership 中的 projectId → role。 */
async function memberRolesOf(req: PayloadRequest): Promise<Map<number, string>> {
  const { user, payload } = req
  if (!user) return new Map()
  const found = await payload.find({
    collection: 'memberships',
    overrideAccess: true,
    where: { user: { equals: user.id } },
    pagination: false,
    limit: 0,
    depth: 0,
  })
  const map = new Map<number, string>()
  for (const m of found.docs) map.set(Number(m.project), m.role)
  return map
}

/** 当前用户是成员的项目 id 集合（管理员返回 null 表示不限）。 */
export async function memberProjectIds(req: PayloadRequest): Promise<number[] | null> {
  if (isGlobalAdmin(req.user)) return null
  return [...(await memberRolesOf(req)).keys()]
}

/** 当前用户是否拥有对至少一个项目的写权限（owner/admin/editor）；管理员为 true。 */
const WRITE_ROLES = new Set(['owner', 'admin', 'editor'])
export async function memberCanWrite(req: PayloadRequest): Promise<boolean> {
  if (isGlobalAdmin(req.user)) return true
  for (const role of (await memberRolesOf(req)).values()) {
    if (WRITE_ROLES.has(role)) return true
  }
  return false
}

/** 当前用户是否对指定项目拥有写权限（owner/admin/editor）；管理员为 true。 */
export async function memberCanWriteProject(req: PayloadRequest, projectId: number): Promise<boolean> {
  if (isGlobalAdmin(req.user)) return true
  const role = (await memberRolesOf(req)).get(projectId)
  return role !== undefined && WRITE_ROLES.has(role)
}

/** 当前用户是否为指定项目成员（任意角色）；管理员为 true。 */
export async function isProjectMember(req: PayloadRequest, projectId: number): Promise<boolean> {
  if (isGlobalAdmin(req.user)) return true
  return (await memberRolesOf(req)).has(projectId)
}

/** 当前用户是否为项目管理者（owner/admin），或全局 admin。用于成员管理。 */
const MANAGE_ROLES = new Set(['owner', 'admin'])
export async function memberCanManage(req: PayloadRequest): Promise<boolean> {
  if (isGlobalAdmin(req.user)) return true
  for (const role of (await memberRolesOf(req)).values()) {
    if (MANAGE_ROLES.has(role)) return true
  }
  return false
}

/** 受项目隔离的集合读取：管理员全见；成员仅见自己所属项目；未登录/非成员不可见。 */
export const projectScopedRead: Access = async ({ req }) => {
  const ids = await memberProjectIds(req)
  if (ids === null) return true
  if (ids.length === 0) return false
  return { project: { in: ids } }
}

/** 受项目隔离的写入：管理员或项目成员(owner/admin/editor)。 */
export const projectWrite: Access = async ({ req }) => memberCanWrite(req)

/** 成员管理权限：管理员或项目 owner/admin。 */
export const membershipManage: Access = async ({ req }) => memberCanManage(req)