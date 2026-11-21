import { DownloadOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons'
import { App, Button, Checkbox, Input, InputNumber, Modal, Select, Space, Table, Tabs, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import ModelSelect, { modelOf } from '../components/ModelSelect'
import { CategoryTag } from '../components/Tags'
import { useAuth } from '../lib/auth'
import { errorText } from '../lib/errors'
import { exportXlsx, xlsxName } from '../lib/excel'
import { money, todayAccra, usd } from '../lib/format'
import { useT } from '../lib/i18n'
import { CATEGORIES, CATEGORY_LABEL } from '../lib/labels'
import { fetchAll, supabase } from '../lib/supabase'
import type { ReportRow } from '../lib/supabase'

type LocDetail = {
  current_location: string | null
  category: string | null
  product_code: string | null
  brand: string | null
  product_name: string | null
  model: string | null
  color: string | null
  qty: number | null
}

const key = (r: { product_code: string | null; model: string | null; brand: string | null; product_name: string | null; color: string | null }) =>
  [r.product_code, r.brand, r.product_name, r.model, r.color].join('|')

export default function ReportPage() {
  const t = useT()
  const { message } = App.useApp()
  const { canWrite } = useAuth()
  const [rows, setRows] = useState<ReportRow[]>([])
  const [byLoc, setByLoc] = useState<LocDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<string>('Passenger')
  const [showZero, setShowZero] = useState(false)
  const [q, setQ] = useState('')
  const [model, setModel] = useState<string | undefined>()
  const [loc, setLoc] = useState<string | undefined>()
  const [pricing, setPricing] = useState<{ code: string; name: string; price: number | null } | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [r, l] = await Promise.all([
      fetchAll<ReportRow>(() =>
        supabase.from('stock_report').select('*').order('brand').order('product_name').order('model').order('color').order('product_code'),
      ),
      fetchAll<LocDetail>(() =>
        supabase.from('stock_by_location').select('*').order('current_location').order('category').order('brand').order('product_code').order('model'),
      ),
    ])
    setRows(r.data)
    setByLoc(l.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const match = useCallback(
    (r: { brand: string | null; product_name: string | null; model: string | null; color: string | null; product_code: string | null }) => {
      if (model && modelOf(r) !== model) return false
      const s = q.trim().toUpperCase()
      if (!s) return true
      return [r.brand, r.product_name, r.model, r.color, r.product_code].join(' ').toUpperCase().includes(s)
    },
    [q, model],
  )

  const byCat = useMemo(() => {
    const out: Record<string, ReportRow[]> = { Passenger: [], Heavy: [], Other: [] }
    for (const r of rows) {
      if (!showZero && Number(r.total_qty ?? 0) <= 0) continue
      if (!match(r)) continue
      ;(out[r.category ?? 'Other'] ??= []).push(r)
    }
    return out
  }, [rows, showZero, match])

  const locNames = useMemo(() => [...new Set(byLoc.map((r) => r.current_location ?? ''))].sort(), [byLoc])
  const locRows = useMemo(() => byLoc.filter((r) => (!loc || r.current_location === loc) && match(r)), [byLoc, loc, match])

  // 型号下拉：按类别看时列所有类别里有库存的型号（勾了“显示库存为 0”就全列），按位置看时只列这个位置的
  const visible = useCallback((r: ReportRow) => showZero || Number(r.total_qty ?? 0) > 0, [showZero])
  const modelRows = useMemo(
    () => (tab === 'loc' ? byLoc.filter((r) => !loc || r.current_location === loc) : rows.filter(visible)),
    [tab, byLoc, loc, rows, visible],
  )
  const pickModel = (v?: string) => {
    setModel(v)
    // 当前类别里没有这个型号，就跳到有它的类别
    if (!v || tab === 'loc') return
    const has = (c: string) => rows.some((r) => r.category === c && modelOf(r) === v && visible(r))
    if (!has(tab)) {
      const other = CATEGORIES.find(has)
      if (other) setTab(other)
    }
  }

  const savePrice = async () => {
    if (!pricing) return
    setSaving(true)
    const { error } = await supabase.rpc('set_product_price', { p_code: pricing.code, p_price_usd: pricing.price as number })
    setSaving(false)
    if (error) return message.error(errorText(error))
    message.success(t('已保存'))
    setPricing(null)
    void load()
  }

  const amount = (r: ReportRow) => (r.price_usd == null ? null : Number(r.total_qty ?? 0) * Number(r.price_usd))

  const columns: ColumnsType<ReportRow> = [
    { title: t('品牌'), dataIndex: 'brand', width: 140, ellipsis: true },
    { title: t('品名'), dataIndex: 'product_name', width: 190, ellipsis: true },
    { title: t('型号'), dataIndex: 'model', width: 190, ellipsis: true },
    { title: t('颜色'), dataIndex: 'color', width: 120, ellipsis: true },
    { title: t('产品编码'), dataIndex: 'product_code', width: 112 },
    {
      title: t('库存'),
      dataIndex: 'total_qty',
      width: 72,
      align: 'right',
      sorter: (a, b) => Number(a.total_qty ?? 0) - Number(b.total_qty ?? 0),
      render: (v: number) => <strong className="num">{Number(v ?? 0)}</strong>,
    },
    {
      title: t('单价（美元）'),
      dataIndex: 'price_usd',
      width: 120,
      align: 'right',
      render: (v: number | null, r) => (
        <Space size={4}>
          <span className="num">{v == null ? '' : money(v, 0)}</span>
          {canWrite && r.product_code && (
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              aria-label={t('改单价')}
              onClick={() =>
                setPricing({ code: r.product_code!, name: [r.brand, r.product_name, r.color].filter(Boolean).join(' · '), price: v })
              }
            />
          )}
        </Space>
      ),
    },
    {
      title: t('金额（美元）'),
      key: 'amount',
      width: 120,
      align: 'right',
      render: (_, r) => <span className="num">{amount(r) == null ? '' : money(amount(r), 0)}</span>,
    },
  ]

  const catTable = (list: ReportRow[]) => {
    const qty = list.reduce((s, r) => s + Number(r.total_qty ?? 0), 0)
    const amt = list.reduce((s, r) => s + (amount(r) ?? 0), 0)
    const unpriced = list.filter((r) => r.price_usd == null && Number(r.total_qty ?? 0) > 0).length
    return (
      <Table<ReportRow>
        rowKey={key}
        size="small"
        loading={loading}
        columns={columns}
        dataSource={list}
        pagination={false}
        scroll={{ x: 1080 }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={5}>
                <strong>{t('合计')}</strong>
                {unpriced > 0 && <span className="hint">　{t('{n} 种还没有单价，金额没算进去', { n: unpriced })}</span>}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="right">
                <strong className="num">{qty}</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={6} />
              <Table.Summary.Cell index={7} align="right">
                <strong className="num">{amt ? usd(amt) : ''}</strong>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
    )
  }

  const locColumns: ColumnsType<LocDetail> = [
    { title: t('位置'), dataIndex: 'current_location', width: 150, ellipsis: true },
    { title: t('类别'), dataIndex: 'category', width: 96, render: (v: string) => <CategoryTag value={v} /> },
    { title: t('品牌'), dataIndex: 'brand', width: 140, ellipsis: true },
    { title: t('品名'), dataIndex: 'product_name', width: 190, ellipsis: true },
    { title: t('型号'), dataIndex: 'model', width: 170, ellipsis: true },
    { title: t('颜色'), dataIndex: 'color', width: 120, ellipsis: true },
    { title: t('产品编码'), dataIndex: 'product_code', width: 112 },
    { title: t('数量'), dataIndex: 'qty', width: 72, align: 'right', render: (v: number) => <strong className="num">{Number(v ?? 0)}</strong> },
  ]

  // 导出跟着页面上的筛选走（搜索、型号、显示库存为 0）；在“按位置”里选了一个位置，就只导出这个位置
  const exportExcel = () => {
    const catSheet = (c: string) => ({
      name: t(CATEGORY_LABEL[c]),
      rows: (byCat[c] ?? []).map((r) => ({
        [t('品牌')]: r.brand,
        [t('品名')]: r.product_name,
        [t('型号')]: r.model,
        [t('颜色')]: r.color,
        [t('产品编码')]: r.product_code,
        [t('库存')]: Number(r.total_qty ?? 0),
        [t('单价（美元）')]: r.price_usd == null ? null : Number(r.price_usd),
        [t('金额（美元）')]: amount(r),
      })),
    })
    const locSheet = (name: string, list: LocDetail[]) => ({
      name,
      rows: list.map((r) => ({
        [t('位置')]: r.current_location,
        [t('类别')]: t(CATEGORY_LABEL[r.category ?? ''] ?? r.category ?? ''),
        [t('品牌')]: r.brand,
        [t('品名')]: r.product_name,
        [t('型号')]: r.model,
        [t('颜色')]: r.color,
        [t('产品编码')]: r.product_code,
        [t('数量')]: Number(r.qty ?? 0),
      })),
    })
    if (tab === 'loc' && loc) return exportXlsx(xlsxName(t('库存报表'), loc, model, todayAccra()), [locSheet(loc, locRows)])
    return exportXlsx(xlsxName(t('库存报表'), model, todayAccra()), [
      ...CATEGORIES.map(catSheet).filter((s) => s.rows.length),
      locSheet(t('按位置'), byLoc.filter(match)),
    ])
  }

  const count = (list: { total_qty?: number | null; qty?: number | null }[]) =>
    list.reduce((s, r) => s + Number(r.total_qty ?? r.qty ?? 0), 0)

  return (
    <div>
      <div className="page-title">
        <h2>{t('库存报表')}</h2>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => void load()} aria-label={t('刷新')} />
          <Button icon={<DownloadOutlined />} onClick={() => void exportExcel()} disabled={!rows.length}>
            {t('导出 Excel')}
          </Button>
        </Space>
      </div>
      <Space wrap className="filters">
        <Input.Search allowClear placeholder={t('品牌、品名、型号、编码')} style={{ width: 240 }} onSearch={setQ} onChange={(e) => !e.target.value && setQ('')} />
        <ModelSelect rows={modelRows} value={model} onChange={pickModel} />
        {tab === 'loc' ? (
          <Select
            allowClear
            placeholder={t('全部位置')}
            style={{ width: 180 }}
            showSearch={{ optionFilterProp: 'label' }}
            value={loc}
            onChange={setLoc}
            options={locNames.map((l) => ({ value: l, label: l }))}
          />
        ) : (
          <Checkbox checked={showZero} onChange={(e) => setShowZero(e.target.checked)}>
            {t('显示库存为 0 的产品')}
          </Checkbox>
        )}
      </Space>
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          ...CATEGORIES.map((c) => ({
            key: c,
            label: `${t(CATEGORY_LABEL[c])} (${count(byCat[c] ?? [])})`,
            children: catTable(byCat[c] ?? []),
          })),
          {
            key: 'loc',
            label: `${t('按位置')} (${count(locRows)})`,
            children: (
              <Table<LocDetail>
                rowKey={(r) => `${r.current_location}|${key(r)}`}
                size="small"
                loading={loading}
                columns={locColumns}
                dataSource={locRows}
                scroll={{ x: 1060 }}
                pagination={{ defaultPageSize: 100, pageSizeOptions: [50, 100, 200, 500], showSizeChanger: true }}
              />
            ),
          },
        ]}
      />
      <Modal
        open={!!pricing}
        title={t('改单价')}
        okText={t('保存')}
        confirmLoading={saving}
        onOk={() => void savePrice()}
        onCancel={() => setPricing(null)}
        destroyOnHidden
      >
        {pricing && (
          <Space orientation="vertical" style={{ width: '100%' }}>
            <Typography.Text>
              {pricing.code} · {pricing.name}
            </Typography.Text>
            <Typography.Text type="secondary">{t('单价按产品编码记，同一个编码的车都用这个单价。')}</Typography.Text>
            <InputNumber
              autoFocus
              style={{ width: '100%' }}
              min={0}
              precision={2}
              prefix="$"
              value={pricing.price}
              onChange={(v) => setPricing({ ...pricing, price: v })}
              onPressEnter={() => void savePrice()}
            />
          </Space>
        )}
      </Modal>
    </div>
  )
}
