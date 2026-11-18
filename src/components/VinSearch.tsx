import { AutoComplete, Input } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useEffect, useRef, useState } from 'react'
import { useT } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import type { Stock } from '../lib/supabase'
import { normVin, vinQuery } from '../lib/vin'
import { StockStatusTag } from './Tags'

/**
 * 找车：输入车架号（后几位也行），下拉里挑。输入的和某台车的车架号完全一样时 onPick 那台车，否则 onPick(null)。
 * 和 Form.Item 一起用时 value / onChange 由表单管。
 */
export default function VinSearch({
  id,
  value,
  onChange,
  onPick,
  autoFocus,
}: {
  /** Form.Item 传进来的，让标签点了能定位到输入框 */
  id?: string
  value?: string
  onChange?: (v: string) => void
  onPick: (row: Stock | null) => void
  autoFocus?: boolean
}) {
  const t = useT()
  // 查到的结果记着是哪个输入查的；输入不到 4 位时不查、不显示
  const [result, setResult] = useState<{ q: string; rows: Stock[] } | null>(null)
  const pickRef = useRef(onPick)
  const q = vinQuery(value)
  const active = q.length >= 4
  const opts = active ? (result?.rows ?? []) : []
  const loading = active && result?.q !== q

  useEffect(() => {
    pickRef.current = onPick
  })

  useEffect(() => {
    if (!active) {
      pickRef.current(null)
      return
    }
    // 从下拉里挑的：先用手上的这条，免得卡片闪一下；下面再去数据库拿最新的
    pickRef.current(result?.rows.find((r) => r.vin === q) ?? null)
    let alive = true
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('vehicle_stock').select('*').ilike('vin', `%${q}%`).order('vin').limit(12)
      if (!alive) return
      const rows = data ?? []
      setResult({ q, rows })
      pickRef.current(rows.find((r) => r.vin === q) ?? null)
    }, 250)
    return () => {
      alive = false
      clearTimeout(timer)
    }
    // result 只在输入变了的那一刻用一下，不用跟着它重跑
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, active])

  return (
    <AutoComplete
      id={id}
      value={value}
      onChange={(v: string) => onChange?.(normVin(v))}
      showSearch={{ filterOption: false }}
      options={opts.map((r) => ({
        value: r.vin ?? '',
        label: (
          <div className="vin-option">
            <span className="vin-option-vin">{r.vin}</span>
            <span className="vin-option-sub">
              {[r.brand, r.product_name, r.color].filter(Boolean).join(' · ')}
              {r.current_location ? ` · ${r.current_location}` : ''}
            </span>
            <StockStatusTag value={r.stock_status} />
          </div>
        ),
      }))}
    >
      <Input
        prefix={<SearchOutlined />}
        placeholder={t('输入车架号，后几位也可以')}
        allowClear
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        suffix={loading ? <span className="hint">{t('查找中…')}</span> : undefined}
      />
    </AutoComplete>
  )
}
