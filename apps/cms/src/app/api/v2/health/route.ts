import { ok } from '../../../../lib/envelope'

export async function GET() {
  return ok({ status: 'ok' })
}

export { OPTIONS } from '../../../../lib/envelope'