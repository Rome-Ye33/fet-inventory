import { Select } from 'antd'
import { useMemo } from 'react'
import { useT } from '../lib/i18n'

type Field = 'model' | 'product_name' | 'color'
type Row = { model?: string | null; product_name?: string | null; color?: string | null; brand?: string | null }
type Option = { value: string; label: string; brands: string }

// 比型号、品名、颜色时去掉前后空格，录入时多打的空格不影响筛选
export const modelOf = (r: { model?: string | null }) => r.model?.trim() ?? ''
export const nameOf = (r: { product_name?: string | null }) => r.product_name?.trim() ?? ''
export const colorOf = (r: { color?: string | null }) => r.color?.trim() ?? ''
const valueOf = (r: Row, field: Field) => (field === 'model' ? modelOf(r) : field === 'product_name' ? nameOf(r) : colorOf(r))

const PLACEHOLDER: Record<Field, string> = { model: '型号', product_name: '品名', color: '颜色' }
const CLASS: Record<Field, string> = { model: 'model-select', product_name: 'name-select', color: 'color-select' }
const WIDTH: Record<Field, [number, number]> = { model: [200, 340], product_name: [220, 400], color: [150, 240] }

// 下拉的选项从页面已经载入的数据里取。同一个型号、品名可能几个品牌都有（比如 3T、FLAT BED平板），
// 下拉里在后面用小字标出品牌，输品牌也能搜到；颜色不标品牌
export function fieldOptions(rows: Row[], field: Field): Option[] {
  const map = new Map<string, Set<string>>()
  for (const r of rows) {
    const v = valueOf(r, field)
    if (!v) continue
    const brands = map.get(v) ?? new Set<string>()
    if (r.brand && field !== 'color') brands.add(r.brand)
    map.set(v, brands)
  }
  return [...map]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([v, brands]) => ({ value: v, label: v, brands: [...brands].sort().join(' · ') }))
}

/** 型号 / 品名 / 颜色筛选下拉（品名能把“自卸车”和“自卸车U斗”这种型号一样的分开） */
export default function ModelSelect({
  field = 'model',
  rows,
  value,
  onChange,
  showBrands = true,
}: {
  field?: Field
  rows: Row[]
  value?: string
  onChange: (v: string | undefined) => void
  /** 已经按品牌筛过的时候不用再标品牌 */
  showBrands?: boolean
}) {
  const t = useT()
  const options = useMemo(() => fieldOptions(rows, field), [rows, field])
  return (
    <Select<string, Option>
      className={CLASS[field]}
      allowClear
      placeholder={t(PLACEHOLDER[field])}
      style={{ width: WIDTH[field][0] }}
      popupMatchSelectWidth={WIDTH[field][1]}
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
