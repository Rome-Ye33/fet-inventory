import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, DatePicker, Input, Select, Space, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import ModelSelect, { modelOf } from '../components/ModelSelect'
import { ActionTag, CategoryTag, MoveStatusTag } from '../components/Tags'
import VehicleDrawer from '../components/VehicleDrawer'
import VoidButton from '../components/VoidButton'
import LinkButton from '../components/LinkButton'
import { useAuth } from '../lib/auth'
import { exportXlsx } from '../lib/excel'
import { dateTime, todayAccra } from '../lib/format'
import { trServer, useT } from '../lib/i18n'
import { ACTION_LABEL, CATEGORIES, CATEGORY_LABEL, MOVE_STATUS_LABEL } from '../lib/labels'
import { useRefData } from '../lib/refdata'
import { fetchAll, supabase } from '../lib/supabase'
import type { Movement } from '../lib/supabase'

type Range = [Dayjs, Dayjs] | null

export default function MovementsPage() {
  const t = useT()
  const { canWrite } = useAuth()
  const { locations } = useRefData()
  const today = dayjs(todayAccra())
  const [range, setRange] = useState<Range>([today.startOf('year'), today])
  const [rows, setRows] = useState<Movement[]>([])
  const [loading, setLoading] = useState(false)
  const [action, setAction] = useState<string | undefined>()
  const [status, setStatus] = useState<string | undefined>()
  const [cat, setCat] = useState<string | undefined>()
  const [model, setModel] = useState<string | undefined>()
  const [loc, setLoc] = useState<string | undefined>()
  const [q, setQ] = useState('')
  const [drawerVin, setDrawerVin] = useState<string | null>(null)
  const from = range?.[0].format('YYYY-MM-DD')
  const to = range?.[1].format('YYYY-MM-DD')

  // 日期在数据库里筛，其余的在浏览器里筛（一年也就几千条）
  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await fetchAll<Movement>(() => {
      let query = supabase.from('movement_log').select('*').order('seq', { ascending: false })
      if (from) query = query.gte('op_date', from)
      if (to) query = query.lte('op_date', to)
      return query
    })
    setRows(data)
    setLoading(false)
  }, [from, to])

  useEffect(() => {
    void load()
  }, [load])

  const shown = useMemo(() => {
    const s = q.trim().toUpperCase()
    return rows.filter((r) => {
      if (action && r.action !== action) return false
      if (status && r.status !== status) return false
      if (cat && r.category !== cat) return false
      if (model && modelOf(r) !== model) return false
      if (loc && r.from_location !== loc && r.to_location !== loc) return false
      if (s) {
        const hay = [r.vin, r.customer, r.to_location, r.from_location, r.brand, r.product_name, r.model, r.product_code, r.remark, r.outbound_no, String(r.seq)]
          .join(' ')
          .toUpperCase()
        if (!hay.includes(s)) return false
      }
      return true
    })
  }, [rows, action, status, cat, model, loc, q])

  // 型号下拉只列选中类别里有的型号
  const modelRows = useMemo(() => (cat ? rows.filter((r) => r.category === cat) : rows), [rows, cat])
  const changeCat = (v?: string) => {
    setCat(v)
    // 换了类别，原来选的型号这个类别里没有就一起清掉
    if (model && v && !rows.some((r) => r.category === v && modelOf(r) === model)) setModel(undefined)
  }

  const totals = useMemo(() => {
    const n: Record<string, number> = { INBOUND: 0, SOLD: 0, TRANSFER: 0 }
    for (const r of shown) if (r.status === 'ACTIVE' && r.action) n[r.action] = (n[r.action] ?? 0) + Number(r.qty ?? 0)
    return n
  }, [shown])

  const exportExcel = () =>
    exportXlsx(`${t('流水')}_${from ?? ''}_${to ?? ''}.xlsx`, [
      {
        name: t('流水'),
        rows: shown.map((r) => ({
          [t('流水号')]: r.seq,
          [t('日期')]: r.op_date,
          [t('操作')]: t(ACTION_LABEL[r.action ?? ''] ?? r.action ?? ''),
          [t('车架号')]: r.vin,
          [t('类别')]: t(CATEGORY_LABEL[r.category ?? ''] ?? r.category ?? ''),
          [t('产品编码')]: r.product_code,
          [t('品牌')]: r.brand,
          [t('品名')]: r.product_name,
          [t('型号')]: r.model,
          [t('颜色')]: r.color,
          [t('数量')]: Number(r.qty ?? 0),
          [t('从')]: r.from_location,
          [t('到 / 客户')]: r.to_location,
          [t('报关状态')]: r.customs_status ? t(r.customs_status) : '',
          [t('状态')]: t(MOVE_STATUS_LABEL[r.status ?? ''] ?? r.status ?? ''),
          [t('作废原因')]: r.void_reason ? trServer(r.void_reason) : '',
          [t('出库单号')]: r.outbound_no,
          [t('录入人')]: r.created_by_name,
          [t('录入时间')]: dateTime(r.input_time),
          [t('备注')]: r.remark,
        })),
      },
    ])

  const columns: ColumnsType<Movement> = [
    { title: t('流水号'), dataIndex: 'seq', width: 80, sorter: (a, b) => Number(a.seq) - Number(b.seq) },
    { title: t('日期'), dataIndex: 'op_date', width: 104, sorter: (a, b) => (a.op_date ?? '').localeCompare(b.op_date ?? '') },
    { title: t('操作'), dataIndex: 'action', width: 72, render: (v: string) => <ActionTag value={v} /> },
    {
      title: t('车架号'),
      dataIndex: 'vin',
      width: 190,
      render: (v: string) => <LinkButton onClick={() => setDrawerVin(v)}>{v}</LinkButton>,
    },
    { title: t('类别'), dataIndex: 'category', width: 96, render: (v: string) => <CategoryTag value={v} /> },
    {
      title: t('车辆'),
      key: 'product',
      width: 240,
      ellipsis: true,
      render: (_, r) => [r.brand, r.product_name, r.model, r.color].filter(Boolean).join(' · '),
    },
    { title: t('从'), dataIndex: 'from_location', width: 140, ellipsis: true },
    { title: t('到 / 客户'), dataIndex: 'to_location', width: 170, ellipsis: true },
    { title: t('状态'), dataIndex: 'status', width: 84, render: (v: string, r) => <MoveStatusTag value={v} reason={r.void_reason} /> },
    { title: t('录入人'), dataIndex: 'created_by_name', width: 110, ellipsis: true },
    { title: t('备注'), dataIndex: 'remark', width: 180, ellipsis: true },
    ...(canWrite
      ? [
          {
            title: '',
            key: 'op',
            width: 64,
            fixed: 'right' as const,
            render: (_: unknown, r: Movement) => (r.status === 'ACTIVE' ? <VoidButton move={r} onDone={() => void load()} /> : null),
          },
        ]
      : []),
  ]

  return (
    <div>
      <div className="page-title">
        <h2>{t('流水')}</h2>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => void load()} aria-label={t('刷新')} />
          <Button icon={<DownloadOutlined />} onClick={() => void exportExcel()} disabled={!shown.length}>
            {t('导出 Excel')}
          </Button>
        </Space>
      </div>
      <Space wrap className="filters">
        <DatePicker.RangePicker
          value={range}
          onChange={(v) => setRange(v && v[0] && v[1] ? [v[0], v[1]] : null)}
          presets={[
            { label: t('今天'), value: [today, today] },
            { label: t('本月'), value: [today.startOf('month'), today] },
            { label: t('上月'), value: [today.subtract(1, 'month').startOf('month'), today.subtract(1, 'month').endOf('month')] },
            { label: t('今年'), value: [today.startOf('year'), today] },
          ]}
        />
        <Input.Search
          allowClear
          placeholder={t('车架号、客户、备注、流水号')}
          style={{ width: 240 }}
          onSearch={setQ}
          onChange={(e) => !e.target.value && setQ('')}
        />
        <Select
          allowClear
          placeholder={t('操作')}
          style={{ width: 100 }}
          value={action}
          onChange={setAction}
          options={Object.keys(ACTION_LABEL).map((k) => ({ value: k, label: t(ACTION_LABEL[k]) }))}
        />
        <Select
          allowClear
          placeholder={t('状态')}
          style={{ width: 100 }}
          value={status}
          onChange={setStatus}
          options={Object.keys(MOVE_STATUS_LABEL).map((k) => ({ value: k, label: t(MOVE_STATUS_LABEL[k]) }))}
        />
        <Select
          allowClear
          placeholder={t('类别')}
          style={{ width: 120 }}
          value={cat}
          onChange={changeCat}
          options={CATEGORIES.map((c) => ({ value: c, label: t(CATEGORY_LABEL[c]) }))}
        />
        <ModelSelect rows={modelRows} value={model} onChange={setModel} />
        <Select
          allowClear
          placeholder={t('位置')}
          style={{ width: 170 }}
          showSearch={{ optionFilterProp: 'label' }}
          value={loc}
          onChange={setLoc}
          options={locations.map((l) => ({ value: l.name, label: l.name }))}
        />
      </Space>
      <div className="list-summary">
        {t('共 {n} 条', { n: shown.length })}
        <span className="hint">
          　{t('有效的：入库 {a} 台 · 销售 {b} 台 · 调拨 {c} 台', { a: totals.INBOUND, b: totals.SOLD, c: totals.TRANSFER })}
        </span>
      </div>
      <Table<Movement>
        rowKey="seq"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={shown}
        scroll={{ x: 1600 }}
        pagination={{ defaultPageSize: 50, pageSizeOptions: [20, 50, 100, 200], showSizeChanger: true }}
        rowClassName={(r) => (r.status === 'VOID' ? 'row-void' : '')}
        expandable={{
          rowExpandable: (r) => !!(r.void_reason || r.outbound_no || r.remark),
          expandedRowRender: (r) => (
            <Space orientation="vertical" size={2} className="hint">
              {r.void_reason && (
                <span>
                  {t('作废原因')}：{trServer(r.void_reason)}
                </span>
              )}
              {r.remark && (
                <span>
                  {t('备注')}：{r.remark}
                </span>
              )}
              <span>
                {t('出库单号')}：{r.outbound_no} · {t('录入时间')}：{dateTime(r.input_time)}
                {r.customs_status ? ` · ${t('报关状态')}：${t(r.customs_status)}` : ''}
              </span>
            </Space>
          ),
        }}
      />
      <VehicleDrawer vin={drawerVin} onClose={() => setDrawerVin(null)} onChanged={() => void load()} />
    </div>
  )
}
