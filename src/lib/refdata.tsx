import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './auth'
import type { CatalogList } from './labels'
import { fetchAll, supabase } from './supabase'
import type { CatalogOption, Location, Product } from './supabase'

// 下拉框用的基础资料：位置、品牌/品名/型号/颜色/报关状态的选项、产品编码、用过的客户名。登录后加载一次，改动后调用 reload。
type RefData = {
  loaded: boolean
  locations: Location[]
  /** 启用中的位置名（入库、调拨的下拉框） */
  activeLocations: string[]
  options: Record<CatalogList, string[]>
  products: Product[]
  productByCode: Map<string, Product>
  /** 销售时填过的客户，常用的在前 */
  customers: string[]
  reload: () => Promise<void>
}

const EMPTY_OPTIONS: Record<CatalogList, string[]> = { brand: [], product_name: [], model: [], color: [], customs_status: [] }

const RefContext = createContext<RefData | null>(null)

export function RefDataProvider({ children }: { children: ReactNode }) {
  const { role } = useAuth()
  const [loaded, setLoaded] = useState(false)
  const [locations, setLocations] = useState<Location[]>([])
  const [options, setOptions] = useState<Record<CatalogList, string[]>>(EMPTY_OPTIONS)
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<string[]>([])

  const reload = useCallback(async () => {
    const [l, o, p, c] = await Promise.all([
      supabase.from('locations').select('*').order('kind').order('name'),
      fetchAll<CatalogOption>(() => supabase.from('catalog_options').select('*').order('list').order('sort').order('value')),
      fetchAll<Product>(() => supabase.from('products').select('*').order('code')),
      fetchAll<{ name: string | null }>(() => supabase.from('customer_names').select('name, times').order('times', { ascending: false }).order('name')),
    ])
    setLocations(l.data ?? [])
    const opts: Record<CatalogList, string[]> = { brand: [], product_name: [], model: [], color: [], customs_status: [] }
    for (const row of o.data) {
      const list = opts[row.list as CatalogList]
      if (list && !list.includes(row.value)) list.push(row.value)
    }
    setOptions(opts)
    setProducts(p.data)
    setCustomers(c.data.map((x) => x.name ?? '').filter(Boolean))
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (role) void reload()
  }, [role, reload])

  const value = useMemo<RefData>(
    () => ({
      loaded,
      locations,
      activeLocations: locations.filter((l) => l.active).map((l) => l.name),
      options,
      products,
      productByCode: new Map(products.map((p) => [p.code, p])),
      customers,
      reload,
    }),
    [loaded, locations, options, products, customers, reload],
  )

  return <RefContext.Provider value={value}>{children}</RefContext.Provider>
}

export function useRefData(): RefData {
  const ctx = useContext(RefContext)
  if (!ctx) throw new Error('useRefData must be used inside RefDataProvider')
  return ctx
}
