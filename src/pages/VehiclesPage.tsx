import { DownloadOutlined, ExclamationCircleOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons'
import { Button, Checkbox, Input, Select, Space, Table, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import BoeImportModal from '../components/BoeImportModal'
import LinkButton from '../components/LinkButton'
import ModelSelect, { modelOf } from '../components/ModelSelect'
import { CategoryTag, CustomsTag, ExcludedTag, StockStatusTag } from '../components/Tags'
import VehicleDrawer from '../components/VehicleDrawer'
import { useAuth } from '../lib/auth'
import { exportXlsx, xlsxName } from '../lib/excel'
import { todayAccra } from '../lib/format'
import { useT } from '../lib/i18n'
import { CATEGORIES, CATEGORY_LABEL, STOCK_STATUS_LABEL } from '../lib/labels'
import { useRefData } from '../lib/refdata'
import { fetchAll, supabase } from '../lib/supabase'
import type { Stock } from '../lib/supabase'

const STATUSES = ['In Stock', 'Out of Stock', 'Void'] as const

const needsReview = (r: Stock) => !!r.excluded || !!r.review_note?.trim()

const inCatBrand = (r: Stock, c: string, b: string) => (!c || r.category === c) && (!b || r.brand === b)

export default function VehiclesPage() {
  const t = useT()
  const { locations, options } = useRefData()
  const { canWrite } = useAuth()
  const [params, setParams] = useSearchParams()
  const [rows, setRows] = useState<Stock[]>([])
  const [loading, setLoading] = useState(false)
  const [drawerVin, setDrawerVin] = useState<string | null>(null)
  const [qInput, setQInput] = useState(params.get('q') ?? '')
  const [importOpen, setImportOpen] = useState(false)

  // 筛选条件放在地址栏里：从概览点过来、刷新、发链接给别人都还是同样的筛选
  const review = params.get('review') === '1'
  const status = review ? '' : (params.get('status') ?? 'In Stock')
  const loc = params.get('loc') ?? ''
  const cat = params.get('cat') ?? ''
  const brand = params.get('brand') ?? ''
  const model = params.get('model') ?? ''
  const customs = params.get('customs') ?? ''
  const boe = params.get('boe') ?? ''
  const q = (params.get('q') ?? '').trim().toUpperCase()

  const update = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      // 状态“全部”要记下来，不然会变回默认的“在库”
      if (key === 'status') next.set('status', value || 'all')
      else if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next, { replace: true })
  }
  const setParam = (key: string, value: string | undefined) => update({ [key]: value })

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await fetchAll<Stock>(() => supabase.from('vehicle_stock').select('*').order('vin').order('vehicle_id'))
    setRows(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const brands = useMemo(() => [...new Set(rows.map((r) => r.brand ?? '').filter(Boolean))].sort(), [rows])
  // 型号下拉跟着类别、品牌走：选了品牌就只列这个品牌的型号
  const modelRows = useMemo(() => rows.filter((r) => inCatBrand(r, cat, brand)), [rows, cat, brand])
  // 换了类别或品牌以后，原来选的型号对不上就一起清掉，免得筛出来是空的
  const keepModel = (c: string | undefined, b: string | undefined) =>
    model && rows.some((r) => inCatBrand(r, c ?? '', b ?? '') && modelOf(r) === model) ? model : undefined

  // BOE 号下拉：完税的和保税仓的都列出来，标上是哪种、有几台车
  const boeOptions = useMemo(() => {
    const m = new Map<string, { kind: 'paid' | 'bonded'; n: number }>()
    const add = (no: string | null, kind: 'paid' | 'bonded') => {
      if (!no) return
      const e = m.get(no) ?? { kind, n: 0 }
      e.n++
      m.set(no, e)
    }
    for (const r of rows) {
      add(r.boe_no, 'paid')
      add(r.bonded_boe_no, 'bonded')
    }
    return [...m].sort(([a], [b]) => a.localeCompare(b)).map(([no, e]) => ({ value: no, label: no, kind: e.kind, n: e.n }))
  }, [rows])

  const shown = useMemo(
    () =>
      rows.filter((r) => {
        // 不计库存的车（导入时核对不上的）只在“待核实”里出现，平时的数字和概览、报表对得上
        if (review ? !needsReview(r) : r.excluded) return false
        if (status && status !== 'all' && r.stock_status !== status) return false
        if (loc && r.current_location !== loc) return false
        if (cat && r.category !== cat) return false
        if (brand && r.brand !== brand) return false
        if (model && modelOf(r) !== model) return false
        if (customs && r.customs_status !== customs) return false
        if (boe && r.boe_no !== boe && r.bonded_boe_no !== boe) return false
        if (q) {
          const hay = [r.vin, r.brand, r.product_name, r.model, r.color, r.product_code, r.boe_no, r.bonded_boe_no, r.remark, r.review_note, r.current_location]
            .join(' ')
            .toUpperCase()
          if (!hay.includes(q)) return false
        }
        return true
      }),
    [rows, review, status, loc, cat, brand, model, customs, boe, q],
  )

  // 文件名带上筛选条件（位置、状态等），按分部、代理分别导出时好分
  const fileName = () =>
    xlsxName(
      t('车辆'),
      loc,
      review ? t('待核实') : status && status !== 'all' ? t(STOCK_STATUS_LABEL[status] ?? status) : '',
      cat ? t(CATEGORY_LABEL[cat] ?? cat) : '',
      brand,
      model,
      customs ? t(customs) : '',
      boe,
      todayAccra(),
    )

  const exportExcel = () =>
    exportXlsx(fileName(), [
      {
        name: t('车辆'),
        rows: shown.map((r) => ({
          [t('车架号')]: r.vin,
          [t('类别')]: t(CATEGORY_LABEL[r.category ?? ''] ?? r.category ?? ''),
          [t('产品编码')]: r.product_code,
          [t('品牌')]: r.brand,
          [t('品名')]: r.product_name,
          [t('型号')]: r.model,
          [t('颜色')]: r.color,
          [t('当前位置')]: r.current_location,
          [t('库存')]: Number(r.current_qty ?? 0),
          [t('状态')]: t(STOCK_STATUS_LABEL[r.stock_status ?? ''] ?? r.stock_status ?? ''),
          [t('报关状态')]: r.customs_status ? t(r.customs_status) : '',
          [t('完税 BOE 号')]: r.boe_no,
          [t('保税仓 BOE 号')]: r.bonded_boe_no,
          [t('入库日期')]: r.inbound_date,
          [t('入库位置')]: r.initial_location,
          [t('最后销售日期')]: r.last_sold_date,
          [t('备注')]: r.remark,
          [t('待核实说明')]: r.review_note,
        })),
      },
    ])

  const columns: ColumnsType<Stock> = [
    {
      title: t('车架号'),
      dataIndex: 'vin',
      width: 190,
      fixed: 'left',
      sorter: (a, b) => (a.vin ?? '').localeCompare(b.vin ?? ''),
      render: (v: string, r) => (
        <Space size={4}>
          <LinkButton onClick={() => setDrawerVin(v)}>{v}</LinkButton>
          {needsReview(r) && (
            <Tooltip title={r.review_note || t('待核实')}>
              <ExclamationCircleOutlined className="text-warn" />
            </Tooltip>
          )}
        </Space>
      ),
    },
    { title: t('类别'), dataIndex: 'category', width: 96, render: (v: string) => <CategoryTag value={v} /> },
    { title: t('品牌'), dataIndex: 'brand', width: 130, ellipsis: true, sorter: (a, b) => (a.brand ?? '').localeCompare(b.brand ?? '') },
    { title: t('品名'), dataIndex: 'product_name', width: 170, ellipsis: true },
    { title: t('型号'), dataIndex: 'model', width: 150, ellipsis: true },
    { title: t('颜色'), dataIndex: 'color', width: 110, ellipsis: true },
    { title: t('产品编码'), dataIndex: 'product_code', width: 112 },
    {
      title: t('当前位置'),
      dataIndex: 'current_location',
      width: 140,
      ellipsis: true,
      sorter: (a, b) => (a.current_location ?? '').localeCompare(b.current_location ?? ''),
    },
    {
      title: t('状态'),
      dataIndex: 'stock_status',
      width: 120,
      render: (v: string, r) => (
        <Space size={2} wrap>
          <StockStatusTag value={v} />
          {r.excluded && <ExcludedTag />}
        </Space>
      ),
    },
    { title: t('报关状态'), dataIndex: 'customs_status', width: 96, render: (v: string) => <CustomsTag value={v} /> },
    { title: t('完税 BOE 号'), dataIndex: 'boe_no', width: 150, ellipsis: true },
    { title: t('保税仓 BOE 号'), dataIndex: 'bonded_boe_no', width: 160, ellipsis: true },
    {
      title: t('入库日期'),
      dataIndex: 'inbound_date',
      width: 108,
      sorter: (a, b) => (a.inbound_date ?? '').localeCompare(b.inbound_date ?? ''),
    },
    {
      title: t('最后销售日期'),
      dataIndex: 'last_sold_date',
      width: 116,
      sorter: (a, b) => (a.last_sold_date ?? '').localeCompare(b.last_sold_date ?? ''),
    },
  ]

  return (
    <div>
      <div className="page-title">
        <h2>{t('车辆查询')}</h2>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => void load()} aria-label={t('刷新')} />
          <Button icon={<DownloadOutlined />} onClick={() => void exportExcel()} disabled={!shown.length}>
            {t('导出 Excel')}
          </Button>
          {canWrite && (
            <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
              {t('导入 BOE 表')}
            </Button>
          )}
        </Space>
      </div>
      <Space wrap className="filters">
        <Input.Search
          allowClear
          placeholder={t('车架号、品牌、品名、型号、编码')}
          style={{ width: 260 }}
          value={qInput}
          onChange={(e) => {
            setQInput(e.target.value)
            if (!e.target.value) setParam('q', undefined)
          }}
          onSearch={(v) => setParam('q', v.trim() || undefined)}
        />
        <Select
          allowClear={!review}
          disabled={review}
          placeholder={t('状态')}
          style={{ width: 130 }}
          value={status && status !== 'all' ? status : undefined}
          onChange={(v?: string) => setParam('status', v)}
          options={STATUSES.map((s) => ({ value: s, label: t(STOCK_STATUS_LABEL[s]) }))}
        />
        <Select
          allowClear
          placeholder={t('类别')}
          style={{ width: 120 }}
          value={cat || undefined}
          onChange={(v?: string) => update({ cat: v, model: keepModel(v, brand) })}
          options={CATEGORIES.map((c) => ({ value: c, label: t(CATEGORY_LABEL[c]) }))}
        />
        <Select
          allowClear
          placeholder={t('位置')}
          style={{ width: 170 }}
          showSearch={{ optionFilterProp: 'label' }}
          value={loc || undefined}
          onChange={(v?: string) => setParam('loc', v)}
          options={locations.map((l) => ({ value: l.name, label: l.name }))}
        />
        <Select
          allowClear
          placeholder={t('品牌')}
          style={{ width: 160 }}
          showSearch={{ optionFilterProp: 'label' }}
          value={brand || undefined}
          onChange={(v?: string) => update({ brand: v, model: keepModel(cat, v) })}
          options={brands.map((b) => ({ value: b, label: b }))}
        />
        <ModelSelect rows={modelRows} value={model} onChange={(v) => setParam('model', v)} showBrands={!brand} />
        <Select
          allowClear
          placeholder={t('报关状态')}
          style={{ width: 120 }}
          value={customs || undefined}
          onChange={(v?: string) => setParam('customs', v)}
          options={options.customs_status.map((x) => ({ value: x, label: t(x) }))}
        />
        <Select<string, { value: string; label: string; kind: 'paid' | 'bonded'; n: number }>
          allowClear
          placeholder={t('BOE 号')}
          style={{ width: 190 }}
          popupMatchSelectWidth={300}
          showSearch={{ optionFilterProp: 'label' }}
          value={boe || undefined}
          onChange={(v?: string) => setParam('boe', v)}
          options={boeOptions}
          optionRender={(o) => (
            <div className="model-option">
              <span className="model-option-name">{o.data.label}</span>
              <span className="model-option-brand">
                {t(o.data.kind === 'paid' ? '完税' : '保税仓')} · {o.data.n}
              </span>
            </div>
          )}
        />
        <Checkbox checked={review} onChange={(e) => setParam('review', e.target.checked ? '1' : undefined)}>
          {t('只看待核实')}
        </Checkbox>
      </Space>
      <div className="list-summary">
        {t('共 {n} 台', { n: shown.length })}
        {review && <span className="hint">　{t('待核实：导入时核对不上、或写了待核实说明的车。点车架号可以修改、核实后清掉。')}</span>}
      </div>
      <Table<Stock>
        rowKey="vehicle_id"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={shown}
        scroll={{ x: 1810 }}
        pagination={{ defaultPageSize: 50, pageSizeOptions: [20, 50, 100, 200], showSizeChanger: true }}
        rowClassName={(r) => (r.stock_status === 'Void' ? 'row-void' : '')}
      />
      <VehicleDrawer vin={drawerVin} onClose={() => setDrawerVin(null)} onChanged={() => void load()} />
      <BoeImportModal open={importOpen} vehicles={rows} onClose={() => setImportOpen(false)} onDone={() => void load()} />
    </div>
  )
}
