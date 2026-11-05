import { drizzle } from 'drizzle-orm/d1'
import * as authSchema from './auth-schema'
import * as schema from './schema'

export function getDb(d1: D1Database) {
  return drizzle(d1, { schema: { ...schema, ...authSchema } })
}
