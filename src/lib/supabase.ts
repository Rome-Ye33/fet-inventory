import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Supabase 项目「FET AUTO Inventory」。publishable key 本来就是给前端用的，数据靠数据库里的权限（RLS）保护
const url = import.meta.env.VITE_SUPABASE_URL || 'https://ueyriasnprqtqgvmkjwc.supabase.co'
const key = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_yQbkr3HRZc_r3YbD_qEflw_RfeJyv3t'

export const supabase = createClient<Database>(url, key)

type PublicSchema = Database['public']
export type TableRow<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type ViewRow<T extends keyof PublicSchema['Views']> = PublicSchema['Views'][T]['Row']

export type Role = 'admin' | 'staff' | 'viewer'
export type AppUser = TableRow<'app_users'>
export type Location = TableRow<'locations'>
export type CatalogOption = TableRow<'catalog_options'>
export type Product = TableRow<'products'>
export type Stock = ViewRow<'vehicle_stock'>
export type Movement = ViewRow<'movement_log'>
export type ReportRow = ViewRow<'stock_report'>
export type Invite = PublicSchema['Functions']['list_invites']['Returns'][number]

type Page<T> = { data: T[] | null; error: { message: string } | null }
/**
 * Supabase 的接口每次最多回 1000 行，超过的分页取完（车和流水都超过 1000 行）。
 * make 每次新建同一个查询；排序要唯一（最后带上主键），翻页才不会重复或漏行。
 */
export async function fetchAll<T>(
  make: () => { range: (from: number, to: number) => PromiseLike<Page<T>> },
  pageSize = 1000,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const out: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await make().range(from, from + pageSize - 1)
    if (error) return { data: out, error }
    out.push(...(data ?? []))
    if (!data || data.length < pageSize) return { data: out, error: null }
  }
}
