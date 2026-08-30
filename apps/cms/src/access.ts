import type { Access, PayloadRequest } from 'payload'

/** 已登录用户（后台/内网接口）。 */
export const authenticated: Access = ({ req: { user } }) => Boolean(user)

/** 仅全局管理员。用于用户账号等组织级资源的写/删，防非管理员提权。 */
export const adminOnly: Access = ({ req: { user } }) => isGlobalAdmin(user)

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

/** 受项目隔离的读取：管理员全见；成员仅见自己所属项目；未登录/非成员不可见。 */
export const projectScopedRead: Access = async ({ req }) => {
  const ids = await memberProjectIds(req)
  if (ids === null) return true
  if (ids.length === 0) return false
  return { project: { in: ids } }
}

/** 受项目隔离的写入：管理员全权；成员仅能改/删自己所属项目的文档。常配合带 project 字段的集合。 */
export const projectScopedWrite: Access = async ({ req }) => {
  const ids = await memberProjectIds(req)
  if (ids === null) return true
  if (ids.length === 0) return false
  return { project: { in: ids } }
}

/** 受项目隔离的写入：管理员或项目成员(owner/admin/editor)。 */
export const projectWrite: Access = async ({ req }) => memberCanWrite(req)

/** 当前用户是否为指定项目管理者（owner/admin）或全局 admin。 */
export async function memberCanManageProject(req: PayloadRequest, projectId: number): Promise<boolean> {
  if (isGlobalAdmin(req.user)) return true
  const role = (await memberRolesOf(req)).get(projectId)
  return role !== undefined && MANAGE_ROLES.has(role)
}

/** 项目级管理写入口：有 id 时按目标项目校验（防跨项目），创建时要求任一项目可管理。仅适用于 id 即项目 id 的集合（如 projects）。 */
export const projectManage: Access = async ({ req, id }) => {
  if (id != null) return memberCanManageProject(req, Number(id))
  return memberCanManage(req)
}

/** 成员管理（项目隔离）：管理员全权；非管理员只能管理身为 owner/admin 的项目。
 *  创建校验 data.project；改/删校验目标成员记录所在项目，杜绝跨项目成员管理越权。 */
export const membershipScopedManage: Access = async ({ req, id, data }) => {
  if (isGlobalAdmin(req.user)) return true
  if (!req.user) return false
  if (id == null) {
    const projectId = Number(data?.project)
    return projectId > 0 && (await memberCanManageProject(req, projectId))
  }
  const m = await req.payload.findByID({ collection: 'memberships', overrideAccess: true, id: Number(id), depth: 0 })
  return memberCanManageProject(req, Number(m?.project))
}

/** 指定用户是否为指定项目成员（任意角色），全局管理员视为任意项目成员。用于校验线索归属分配。 */
export async function isProjectMemberOf(req: PayloadRequest, projectId: number, userId: number): Promise<boolean> {
  const user = await req.payload.findByID({ collection: 'users', overrideAccess: true, id: userId, depth: 0 })
  if (!user) return false
  if (isGlobalAdmin(user)) return true
  const found = await req.payload.find({
    collection: 'memberships',
    overrideAccess: true,
    where: { and: [{ project: { equals: projectId } }, { user: { equals: userId } }] },
    limit: 1,
    depth: 0,
  })
  return found.docs.length > 0
}

/** 线索写入（项目隔离）：管理员全权；非管理员仅能对其有写权限的项目操作线索（防跨项目写）。
 *  创建校验 data.project；改/删校验目标线索所在项目；改后跨项目移动时还须具备新项目写权限；
 *  直接改 owner 时，跟进人须为该线索所属项目成员（防越权分配）。 */
export const leadScopedWrite: Access = async ({ req, id, data }) => {
  if (isGlobalAdmin(req.user)) return true
  if (!req.user) return false
  if (id == null) {
    const projectId = Number(data?.project)
    return projectId > 0 && (await memberCanWriteProject(req, projectId))
  }
  const lead = await req.payload.findByID({ collection: 'leads', overrideAccess: true, id: Number(id), depth: 0 })
  const projectId = Number(lead?.project)
  if (!(await memberCanWriteProject(req, projectId))) return false
  const newRaw = data?.project
  if (newRaw != null) {
    const newProjectId = Number(typeof newRaw === 'object' && newRaw !== null ? (newRaw as { id: number }).id : newRaw)
    if (newProjectId > 0 && newProjectId !== projectId && !(await memberCanWriteProject(req, newProjectId))) {
      return false
    }
  }
  const ownerRaw = data?.owner
  if (ownerRaw != null && String(ownerRaw) !== String(lead?.owner)) {
    const ownerId = Number(
      typeof ownerRaw === 'object' && ownerRaw !== null ? (ownerRaw as { id: number }).id : ownerRaw,
    )
    if (!(await isProjectMemberOf(req, projectId, ownerId))) return false
  }
  return true
}