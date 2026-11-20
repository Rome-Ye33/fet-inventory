import { Select } from 'antd'
import { useMemo } from 'react'
import { useT } from '../lib/i18n'

type Row = { model?: string | null; brand?: string | null }
type ModelOption = { value: string; label: string; brands: string }

// 比型号时去掉前后空格，录入时多打的空格不影响筛选
export const modelOf = (r: { model?: string | null }) => r.model?.trim() ?? ''

// 型号下拉的选项从页面已经载入的数据里取。同一个型号可能几个品牌都有（比如 3T），
// 下拉里在后面用小字标出品牌，输品牌也能搜到
export function modelOptions(rows: Row[]): ModelOption[] {
  const map = new Map<string, Set<string>>()
  for (const r of rows) {
    const m = modelOf(r)
    if (!m) continue
    const brands = map.get(m) ?? new Set<string>()
    if (r.brand) brands.add(r.brand)
    map.set(m, brands)
  }
  return [...map]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([m, brands]) => ({ value: m, label: m, brands: [...brands].sort().join(' · ') }))
}

export default function ModelSelect({
  rows,
  value,
  onChange,
  showBrands = true,
}: {
  rows: Row[]
  value?: string
  onChange: (v: string | undefined) => void
  /** 已经按品牌筛过的时候不用再标品牌 */
  showBrands?: boolean
}) {
  const t = useT()
  const options = useMemo(() => modelOptions(rows), [rows])
  return (
    <Select<string, ModelOption>
      className="model-select"
      allowClear
      placeholder={t('型号')}
      style={{ width: 200 }}
      popupMatchSelectWidth={340}
      showSearch={{ optionFilterProp: ['label', 'brands'] }}
      value={value || undefined}
      onChange={(v) => onChange(v || undefined)}
      options={options}
      optionRender={(o) => (
        <div className="model-option">
          <span className="model-option-name">{o.data.label}</span>
          {showBrands && o.data.brands && <span className="model-option-brand">{o.data.brands}</span>}
        </div>
      )}
    />
  )
}
