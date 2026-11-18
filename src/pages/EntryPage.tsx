import { CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  Alert,
  App,
  AutoComplete,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import LinkButton from '../components/LinkButton'
import { ActionTag, MoveStatusTag } from '../components/Tags'
import VehicleDrawer, { VehicleInfo } from '../components/VehicleDrawer'
import VinSearch from '../components/VinSearch'
import VoidButton from '../components/VoidButton'
import { errorText } from '../lib/errors'
import { todayAccra } from '../lib/format'
import { useT } from '../lib/i18n'
import { CATEGORIES, CATEGORY_LABEL, CATEGORY_PREFIX } from '../lib/labels'
import type { CatalogList } from '../lib/labels'
import { useRefData } from '../lib/refdata'
import { supabase } from '../lib/supabase'
import type { Movement, Stock } from '../lib/supabase'
import { normVin, vinCheck, vinQuery } from '../lib/vin'

type Ctx = { opDate: string; done: () => void }

/** 输入框的下拉：已有的选项，按输入的字过滤（不分大小写） */
function optionList(values: string[]) {
  return values.map((v) => ({ value: v }))
}
const filterText = (input: string, o?: { value?: unknown }) => String(o?.value ?? '').toUpperCase().includes(input.trim().toUpperCase())

/** 能不能出库（销售、调拨）：返回不能的原因 */
function outBlocked(row: Stock | null, t: (s: string) => string): string | null {
  if (!row) return null
  if (row.stock_status === 'Void') return t('这台车的入库已经作废了，要先重新入库')
  if ((row.current_qty ?? 0) <= 0) return t('这台车已经卖出了')
  return null
}

// ---------------- 入库 ----------------

type InboundValues = {
  vin: string
  category: string
  brand: string
  product_name: string
  model?: string
  color: string
  location: string
  customs_status?: string
  remark?: string
}

function InboundForm({ opDate, done }: Ctx) {
  const t = useT()
  const { message } = App.useApp()
  const { options, activeLocations, products, productByCode, reload } = useRefData()
  const [form] = Form.useForm<InboundValues>()
  const [busy, setBusy] = useState(false)
  const vin = Form.useWatch('vin', form)
  const category = Form.useWatch('category', form)
  const brand = Form.useWatch('brand', form)
  const productName = Form.useWatch('product_name', form)
  const color = Form.useWatch('color', form)
  // 查到的结果记着是查哪个车架号 / 哪组产品信息的，输入变了就不算数（不用在 effect 里清空）
  const [found, setFound] = useState<{ vin: string; row: Stock | null } | null>(null)
  const [suggested, setSuggested] = useState<{ key: string; code: string | null } | null>(null)
  const q = normVin(vin)
  const existing = found && found.vin === q ? found.row : null
  const productKey = category && brand?.trim() && productName?.trim() && color?.trim() ? JSON.stringify([category, brand, productName, color]) : ''
  const code = suggested && suggested.key === productKey ? suggested.code : null

  // 车架号已经在系统里了吗（作废过入库的可以重新入库）
  useEffect(() => {
    if (q.length < 4) return
    let alive = true
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('vehicle_stock').select('*').eq('vin', q).maybeSingle()
      if (alive) setFound({ vin: q, row: data })
    }, 300)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [q])

  // 产品编码：类别 + 品牌 + 品名 + 颜色 一样的用已有编码，没有的按类别顺延一个新编码（和 Excel 一样）
  useEffect(() => {
    if (!productKey) return
    const [c, b, n, col] = JSON.parse(productKey) as string[]
    let alive = true
    const timer = setTimeout(async () => {
      const { data } = await supabase.rpc('suggest_product_code', { p_category: c, p_brand: b, p_product_name: n, p_color: col })
      if (alive) setSuggested({ key: productKey, code: data ?? null })
    }, 300)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [productKey])

  const duplicate = existing && existing.stock_status !== 'Void'
  const check = vin ? vinCheck(vin) : 'skip'

  // 选一个已有产品，把类别、品牌、品名、颜色一起填上
  const pickProduct = (c: string) => {
    const p = productByCode.get(c)
    if (p) form.setFieldsValue({ category: p.category, brand: p.brand, product_name: p.product_name, color: p.color })
  }

  const submit = async (v: InboundValues) => {
    setBusy(true)
    const { data: seq, error } = await supabase.rpc('submit_inbound', {
      p_vin: normVin(v.vin),
      p_category: v.category,
      p_brand: v.brand.trim(),
      p_product_name: v.product_name.trim(),
      p_model: v.model?.trim() ?? '',
      p_color: v.color.trim(),
      p_location: v.location,
      p_customs_status: v.customs_status ?? '',
      p_remark: v.remark?.trim() || undefined,
      p_op_date: opDate,
    })
    if (error) {
      setBusy(false)
      return message.error(errorText(error))
    }
    // 新的品牌、品名、型号、颜色加进下拉选项（和 Excel 一样，下次直接选）
    const fresh = (['brand', 'product_name', 'model', 'color'] as CatalogList[])
      .map((k) => ({ k, val: String(v[k as keyof InboundValues] ?? '').trim() }))
      .filter(({ k, val }) => val && !options[k].some((o) => o.toUpperCase() === val.toUpperCase()))
    await Promise.all(fresh.map(({ k, val }) => supabase.rpc('add_catalog_option', { p_list: k, p_value: val })))
    if (fresh.length || (code && !productByCode.has(code))) void reload()
    setBusy(false)
    message.success(t('入库成功：{vin}，流水号 {seq}', { vin: normVin(v.vin), seq: seq ?? '' }))
    // 同一批车常常一样：留着产品和位置，只清车架号和备注
    form.setFieldsValue({ vin: '', remark: '' })
    setFound(null)
    done()
  }

  const prefix = category ? CATEGORY_PREFIX[category] : null

  return (
    <Form form={form} name="inbound" layout="vertical" onFinish={submit} requiredMark="optional" initialValues={{ category: 'Passenger' }}>
      <Form.Item
        name="vin"
        label={t('车架号 VIN')}
        normalize={(x: string) => normVin(x)}
        rules={[{ required: true, message: t('请输入车架号') }]}
        validateStatus={duplicate ? 'error' : check === 'bad' ? 'warning' : undefined}
        help={
          duplicate
            ? t('这个车架号已经入过库了（{status}，在 {loc}），不能重复入库', {
                status: existing?.stock_status === 'In Stock' ? t('在库') : t('已售出'),
                loc: existing?.current_location ?? '',
              })
            : existing
              ? t('这个车架号以前入库后作废了，可以重新入库')
              : check === 'bad'
                ? t('车架号校验位对不上，请再核对一下有没有输错（工程机械的编号可以不管）')
                : undefined
        }
      >
        <Input autoFocus autoComplete="off" spellCheck={false} maxLength={30} placeholder="LGXCE4CB0P0123456" />
      </Form.Item>
      <Form.Item label={t('从已有产品选')} extra={t('选了会自动填好类别、品牌、品名、颜色；新产品直接在下面填')}>
        <Select
          allowClear
          placeholder={t('输入产品编码、品牌或品名')}
          showSearch={{ optionFilterProp: 'label' }}
          onChange={(c?: string) => c && pickProduct(c)}
          options={products.map((p) => ({ value: p.code, label: `${p.code} · ${p.brand} · ${p.product_name} · ${p.color}` }))}
        />
      </Form.Item>
      <Form.Item name="category" label={t('类别')} rules={[{ required: true }]}>
        <Radio.Group optionType="button" options={CATEGORIES.map((c) => ({ value: c, label: t(CATEGORY_LABEL[c]) }))} />
      </Form.Item>
      <Row gutter={12}>
        <Col xs={24} sm={12}>
          <Form.Item name="brand" label={t('品牌')} rules={[{ required: true, whitespace: true, message: t('请填品牌') }]}>
            <AutoComplete options={optionList(options.brand)} showSearch={{ filterOption: filterText }} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="product_name" label={t('品名')} rules={[{ required: true, whitespace: true, message: t('请填品名') }]}>
            <AutoComplete options={optionList(options.product_name)} showSearch={{ filterOption: filterText }} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="model" label={t('型号')}>
            <AutoComplete options={optionList(options.model)} showSearch={{ filterOption: filterText }} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="color" label={t('颜色')} rules={[{ required: true, whitespace: true, message: t('请填颜色') }]}>
            <AutoComplete options={optionList(options.color)} showSearch={{ filterOption: filterText }} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="location" label={t('入库位置')} rules={[{ required: true, message: t('请选择入库位置') }]}>
            <Select showSearch={{ optionFilterProp: 'label' }} options={activeLocations.map((l) => ({ value: l, label: l }))} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="customs_status" label={t('报关状态')}>
            <Select allowClear options={options.customs_status.map((x) => ({ value: x, label: t(x) }))} />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="remark" label={t('备注')}>
        <Input.TextArea rows={2} maxLength={500} />
      </Form.Item>
      <div className="entry-code">
        {code ? (
          <>
            {t('产品编码')}：<Typography.Text strong>{code}</Typography.Text>{' '}
            <span className="hint">{productByCode.has(code) ? t('（已有产品）') : t('（新产品，入库时自动建档）')}</span>
          </>
        ) : (
          <span className="hint">
            {t('产品编码：填好类别、品牌、品名、颜色后自动生成')}
            {prefix ? ` (${prefix}…)` : ''}
          </span>
        )}
      </div>
      <Button type="primary" htmlType="submit" block size="large" loading={busy} disabled={!!duplicate} icon={<CheckCircleOutlined />}>
        {t('确认入库')}
      </Button>
    </Form>
  )
}

// ---------------- 销售、调拨 ----------------

type OutValues = { vin: string; target: string; remark?: string }

function OutForm({ kind, opDate, done }: Ctx & { kind: 'sale' | 'transfer' }) {
  const t = useT()
  const { message } = App.useApp()
  const { customers, activeLocations, reload } = useRefData()
  const [form] = Form.useForm<OutValues>()
  const [row, setRow] = useState<Stock | null>(null)
  const [busy, setBusy] = useState(false)
  const vin = Form.useWatch('vin', form)
  const blocked = outBlocked(row, t)
  const notFound = !row && vinQuery(vin).length >= 8

  const submit = async (v: OutValues) => {
    if (!row?.vin) return message.error(t('请先找到这台车'))
    setBusy(true)
    const target = v.target.trim()
    const { data: seq, error } =
      kind === 'sale'
        ? await supabase.rpc('submit_sale', { p_vin: row.vin, p_customer: target, p_remark: v.remark?.trim() || undefined, p_op_date: opDate })
        : await supabase.rpc('submit_transfer', { p_vin: row.vin, p_to_location: target, p_remark: v.remark?.trim() || undefined, p_op_date: opDate })
    setBusy(false)
    if (error) return message.error(errorText(error))
    message.success(
      kind === 'sale'
        ? t('销售成功：{vin} 卖给 {who}，流水号 {seq}', { vin: row.vin, who: target, seq: seq ?? '' })
        : t('调拨成功：{vin} 调到 {who}，流水号 {seq}', { vin: row.vin, who: target, seq: seq ?? '' }),
    )
    if (kind === 'sale' && !customers.includes(target)) void reload()
    form.resetFields()
    setRow(null)
    done()
  }

  return (
    <Form form={form} name={kind} layout="vertical" onFinish={submit} requiredMark="optional">
      <Form.Item name="vin" label={t('车架号 VIN')} rules={[{ required: true, message: t('请输入车架号') }]}>
        <VinSearch onPick={setRow} autoFocus />
      </Form.Item>
      {row && (
        <div style={{ marginBottom: 16 }}>
          <VehicleInfo v={row} column={1} />
          {(row.excluded || row.review_note?.trim()) && (
            <Alert
              style={{ marginTop: 8 }}
              type="warning"
              showIcon
              title={row.excluded ? t('这台车不计入库存（导入时核对不上，待核实）') : t('待核实')}
              description={row.review_note?.trim() || undefined}
            />
          )}
          {blocked && <Alert style={{ marginTop: 8 }} type="error" showIcon title={blocked} />}
        </div>
      )}
      {notFound && <Alert style={{ marginBottom: 16 }} type="info" showIcon title={t('还没有找到这台车，可以从下拉里选，或者先去入库')} />}
      {kind === 'sale' ? (
        <Form.Item name="target" label={t('客户')} rules={[{ required: true, whitespace: true, message: t('请填写客户') }]}>
          <AutoComplete options={optionList(customers)} showSearch={{ filterOption: filterText }} placeholder={t('客户名称')} />
        </Form.Item>
      ) : (
        <Form.Item
          name="target"
          label={t('调入位置')}
          dependencies={['vin']}
          rules={[
            { required: true, message: t('请选择调入位置') },
            {
              validator: (_, x: string) =>
                x && row?.current_location === x ? Promise.reject(new Error(t('这台车已经在 {loc} 了', { loc: x }))) : Promise.resolve(),
            },
          ]}
        >
          <Select
            showSearch={{ optionFilterProp: 'label' }}
            options={activeLocations.filter((l) => l !== row?.current_location).map((l) => ({ value: l, label: l }))}
          />
        </Form.Item>
      )}
      <Form.Item name="remark" label={t('备注')}>
        <Input.TextArea rows={2} maxLength={500} />
      </Form.Item>
      <Button type="primary" htmlType="submit" block size="large" loading={busy} disabled={!row || !!blocked} icon={<CheckCircleOutlined />}>
        {kind === 'sale' ? t('确认销售') : t('确认调拨')}
      </Button>
    </Form>
  )
}

// ---------------- 作废 ----------------

function VoidPanel({ done }: Pick<Ctx, 'done'>) {
  const t = useT()
  const [vin, setVin] = useState('')
  const [row, setRow] = useState<Stock | null>(null)
  const [seq, setSeq] = useState<number | null>(null)
  const [loaded, setLoaded] = useState<{ vin: string; moves: Movement[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [miss, setMiss] = useState(false)
  const moves = row?.vin && loaded?.vin === row.vin ? loaded.moves : []

  const loadMoves = useCallback(async (v: string) => {
    setLoading(true)
    const { data } = await supabase.from('movement_log').select('*').eq('vin', v).order('seq')
    setLoaded({ vin: v, moves: data ?? [] })
    setLoading(false)
  }, [])

  useEffect(() => {
    if (row?.vin) void loadMoves(row.vin)
  }, [row, loadMoves])

  // 按流水号找：找到后换成那台车
  const findSeq = async (n: number | null) => {
    setSeq(n)
    setMiss(false)
    if (!n) return
    const { data } = await supabase.from('movement_log').select('vin').eq('seq', n).maybeSingle()
    if (data?.vin) setVin(data.vin)
    else setMiss(true)
  }

  const columns: ColumnsType<Movement> = [
    { title: t('流水号'), dataIndex: 'seq', width: 76 },
    { title: t('日期'), dataIndex: 'op_date', width: 100 },
    { title: t('操作'), dataIndex: 'action', width: 70, render: (v: string) => <ActionTag value={v} /> },
    { title: t('到 / 客户'), dataIndex: 'to_location', ellipsis: true },
    { title: t('状态'), dataIndex: 'status', width: 80, render: (v: string, r) => <MoveStatusTag value={v} reason={r.void_reason} /> },
    {
      title: '',
      key: 'op',
      width: 64,
      render: (_, r) =>
        r.status === 'ACTIVE' ? (
          <VoidButton
            move={r}
            onDone={() => {
              if (row?.vin) void loadMoves(row.vin)
              done()
            }}
          />
        ) : null,
    },
  ]

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
        {t('录错了的流水在这里作废（不会删除，作废的流水还留着可以查）。作废入库会把这台车之后的销售、调拨一起作废。')}
      </Typography.Paragraph>
      <Row gutter={12}>
        <Col xs={24} sm={15}>
          <div className="field-label">{t('车架号 VIN')}</div>
          <VinSearch value={vin} onChange={setVin} onPick={setRow} />
        </Col>
        <Col xs={24} sm={9}>
          <div className="field-label">{t('或按流水号找')}</div>
          <InputNumber style={{ width: '100%' }} min={1} precision={0} value={seq} onChange={(n) => void findSeq(n)} />
        </Col>
      </Row>
      {miss && <Alert type="warning" showIcon title={t('找不到流水号 {seq}', { seq: seq ?? '' })} />}
      {row && (
        <Table<Movement>
          rowKey="seq"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={moves}
          pagination={false}
          scroll={{ x: 560 }}
          rowClassName={(r) => [r.status === 'VOID' ? 'row-void' : '', r.seq === seq ? 'row-hit' : ''].join(' ')}
        />
      )}
    </Space>
  )
}

// ---------------- 最近录入 ----------------

function RecentMoves({ refreshKey, onOpen }: { refreshKey: number; onOpen: (vin: string) => void }) {
  const t = useT()
  const [rows, setRows] = useState<Movement[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('movement_log').select('*').order('seq', { ascending: false }).limit(15)
    setRows(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const columns: ColumnsType<Movement> = [
    { title: t('流水号'), dataIndex: 'seq', width: 70 },
    { title: t('操作'), dataIndex: 'action', width: 64, render: (v: string) => <ActionTag value={v} /> },
    {
      title: t('车架号'),
      dataIndex: 'vin',
      render: (v: string, r) => (
        <div>
          <LinkButton onClick={() => onOpen(v)}>{v}</LinkButton>
          <div className="hint">
            {r.op_date} · {[r.product_name, r.to_location].filter(Boolean).join(' → ')}
          </div>
        </div>
      ),
    },
    { title: t('状态'), dataIndex: 'status', width: 70, render: (v: string, r) => <MoveStatusTag value={v} reason={r.void_reason} /> },
  ]

  return (
    <Card
      title={t('最近录入')}
      size="small"
      extra={<Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => void load()} aria-label={t('刷新')} />}
    >
      <Table<Movement>
        rowKey="seq"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={false}
        rowClassName={(r) => (r.status === 'VOID' ? 'row-void' : '')}
      />
    </Card>
  )
}

// ---------------- 页面 ----------------

const TABS = ['inbound', 'sale', 'transfer', 'void'] as const

export default function EntryPage() {
  const t = useT()
  const [params, setParams] = useSearchParams()
  const tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as string) : 'inbound'
  const [date, setDate] = useState<Dayjs>(() => dayjs(todayAccra()))
  const [refreshKey, setRefreshKey] = useState(0)
  const [drawerVin, setDrawerVin] = useState<string | null>(null)
  const opDate = date.format('YYYY-MM-DD')
  const isToday = opDate === todayAccra()
  const done = useCallback(() => setRefreshKey((k) => k + 1), [])
  const ctx = useMemo(() => ({ opDate, done }), [opDate, done])

  return (
    <div>
      <div className="page-title">
        <h2>{t('录入')}</h2>
        <Space wrap>
          <span>{t('业务日期')}</span>
          <DatePicker
            allowClear={false}
            value={date}
            onChange={(d) => d && setDate(d)}
            disabledDate={(d) => d.isAfter(dayjs(todayAccra()), 'day')}
          />
          {!isToday && (
            <Button type="link" onClick={() => setDate(dayjs(todayAccra()))}>
              {t('回到今天')}
            </Button>
          )}
        </Space>
      </div>
      {!isToday && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('注意：现在录入的业务日期是 {date}，不是今天', { date: opDate })} />}
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card>
            <Tabs
              activeKey={tab}
              onChange={(k) => setParams({ tab: k }, { replace: true })}
              destroyOnHidden
              items={[
                { key: 'inbound', label: t('入库'), children: <InboundForm {...ctx} /> },
                { key: 'sale', label: t('销售'), children: <OutForm kind="sale" {...ctx} /> },
                { key: 'transfer', label: t('调拨'), children: <OutForm kind="transfer" {...ctx} /> },
                { key: 'void', label: t('作废'), children: <VoidPanel done={done} /> },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <RecentMoves refreshKey={refreshKey} onOpen={setDrawerVin} />
        </Col>
      </Row>
      <VehicleDrawer vin={drawerVin} onClose={() => setDrawerVin(null)} onChanged={done} />
    </div>
  )
}
