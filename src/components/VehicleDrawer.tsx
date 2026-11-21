import { EditOutlined } from '@ant-design/icons'
import { Alert, App, AutoComplete, Button, Descriptions, Drawer, Form, Input, Modal, Select, Space, Spin, Switch, Table, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { errorText } from '../lib/errors'
import { usd } from '../lib/format'
import { useT } from '../lib/i18n'
import { useRefData } from '../lib/refdata'
import { supabase } from '../lib/supabase'
import type { Movement, Stock } from '../lib/supabase'
import { ActionTag, CategoryTag, CustomsTag, ExcludedTag, MoveStatusTag, StockStatusTag } from './Tags'
import VoidButton from './VoidButton'

/** 一台车的基本情况（录入页查到车以后、车辆详情里都用这个） */
export function VehicleInfo({ v, column }: { v: Stock; column?: number }) {
  const t = useT()
  const qty = v.stock_status === 'Void' ? '0' : `${v.current_qty ?? 0} / ${v.initial_qty ?? 0}`
  return (
    <Descriptions
      size="small"
      bordered
      column={column ?? { xs: 1, sm: 2 }}
      items={[
        { key: 'vin', label: t('车架号'), children: <Typography.Text copyable strong>{v.vin}</Typography.Text> },
        {
          key: 'status',
          label: t('状态'),
          children: (
            <Space size={4} wrap>
              <StockStatusTag value={v.stock_status} />
              {v.excluded && <ExcludedTag />}
            </Space>
          ),
        },
        { key: 'product', label: t('车辆'), children: [v.brand, v.product_name, v.model].filter(Boolean).join(' · ') },
        { key: 'color', label: t('颜色'), children: v.color },
        {
          key: 'code',
          label: t('产品编码'),
          children: (
            <Space size={4}>
              <CategoryTag value={v.category} />
              {v.product_code}
            </Space>
          ),
        },
        { key: 'loc', label: t('当前位置'), children: v.current_location },
        { key: 'qty', label: t('库存 / 入库数量'), children: qty },
        { key: 'customs', label: t('报关状态'), children: <CustomsTag value={v.customs_status} /> },
        { key: 'boe', label: t('BOE 号'), children: v.boe_no ? <Typography.Text copyable>{v.boe_no}</Typography.Text> : '' },
        { key: 'in', label: t('入库日期'), children: v.inbound_date },
        { key: 'sold', label: t('最后销售日期'), children: v.last_sold_date },
        ...(v.price_usd != null ? [{ key: 'price', label: t('单价（美元）'), children: usd(v.price_usd) }] : []),
        ...(v.remark ? [{ key: 'remark', label: t('备注'), children: v.remark, span: 'filled' as const }] : []),
      ]}
    />
  )
}

type EditValues = { model: string; customs_status: string; boe_no: string; remark: string; review_note: string; excluded: boolean }

/** 车辆详情：基本情况、出入库记录；能录入的人可以改型号、报关状态、BOE 号、备注、待核实说明、是否计入库存，也可以作废流水 */
export default function VehicleDrawer({ vin, onClose, onChanged }: { vin: string | null; onClose: () => void; onChanged?: () => void }) {
  const t = useT()
  const { message } = App.useApp()
  const { canWrite } = useAuth()
  const { options } = useRefData()
  const [row, setRow] = useState<Stock | null>(null)
  const [moves, setMoves] = useState<Movement[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<EditValues>()

  const load = useCallback(async (v: string) => {
    setLoading(true)
    const [s, m] = await Promise.all([
      supabase.from('vehicle_stock').select('*').eq('vin', v).maybeSingle(),
      supabase.from('movement_log').select('*').eq('vin', v).order('seq'),
    ])
    setRow(s.data)
    setMoves(m.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (vin) void load(vin)
    else {
      setRow(null)
      setMoves([])
    }
  }, [vin, load])

  const changed = () => {
    if (vin) void load(vin)
    onChanged?.()
  }

  const openEdit = () => {
    if (!row) return
    form.setFieldsValue({
      model: row.model ?? '',
      customs_status: row.customs_status ?? '',
      boe_no: row.boe_no ?? '',
      remark: row.remark ?? '',
      review_note: row.review_note ?? '',
      excluded: !!row.excluded,
    })
    setEditing(true)
  }

  const save = async (v: EditValues) => {
    if (!row?.vin) return
    setSaving(true)
    const { error } = await supabase.rpc('update_vehicle', {
      p_vin: row.vin,
      p_model: v.model?.trim() ?? '',
      p_customs_status: v.customs_status || undefined,
      p_boe_no: v.boe_no?.trim() ?? '',
      p_remark: v.remark?.trim() ?? '',
      p_review_note: v.review_note?.trim() ?? '',
      p_excluded: v.excluded,
    })
    setSaving(false)
    if (error) return message.error(errorText(error))
    message.success(t('已保存'))
    setEditing(false)
    changed()
  }

  const columns: ColumnsType<Movement> = [
    { title: t('流水号'), dataIndex: 'seq', width: 76 },
    { title: t('日期'), dataIndex: 'op_date', width: 100 },
    { title: t('操作'), dataIndex: 'action', width: 70, render: (v: string) => <ActionTag value={v} /> },
    { title: t('数量'), dataIndex: 'qty', width: 56, align: 'right' },
    { title: t('从'), dataIndex: 'from_location', width: 120, ellipsis: true },
    { title: t('到 / 客户'), dataIndex: 'to_location', width: 140, ellipsis: true },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 80,
      render: (v: string, r) => <MoveStatusTag value={v} reason={r.void_reason} />,
    },
    { title: t('录入人'), dataIndex: 'created_by_name', width: 100, ellipsis: true },
    { title: t('备注'), dataIndex: 'remark', ellipsis: true },
    ...(canWrite
      ? [
          {
            title: '',
            key: 'op',
            width: 60,
            render: (_: unknown, r: Movement) => (r.status === 'ACTIVE' ? <VoidButton move={r} onDone={changed} /> : null),
          },
        ]
      : []),
  ]

  const reviewNote = row?.review_note?.trim()

  return (
    <Drawer
      open={!!vin}
      onClose={onClose}
      size={Math.min(860, typeof window === 'undefined' ? 860 : window.innerWidth)}
      title={vin}
      destroyOnHidden
      extra={
        canWrite && row ? (
          <Button icon={<EditOutlined />} onClick={openEdit}>
            {t('修改')}
          </Button>
        ) : null
      }
    >
      <Spin spinning={loading}>
        {!loading && vin && !row && <Alert type="warning" showIcon title={t('找不到这台车')} />}
        {row && (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            {(reviewNote || row.excluded) && (
              <Alert
                type="warning"
                showIcon
                title={row.excluded ? t('这台车不计入库存（导入时核对不上，待核实）') : t('待核实')}
                description={reviewNote || undefined}
              />
            )}
            <VehicleInfo v={row} />
            <div>
              <Typography.Title level={5}>{t('出入库记录')}</Typography.Title>
              <Table<Movement>
                rowKey="seq"
                size="small"
                columns={columns}
                dataSource={moves}
                pagination={false}
                scroll={{ x: 900 }}
                rowClassName={(r) => (r.status === 'VOID' ? 'row-void' : '')}
              />
            </div>
          </Space>
        )}
      </Spin>
      <Modal
        open={editing}
        title={t('修改车辆信息')}
        okText={t('保存')}
        confirmLoading={saving}
        onOk={() => form.submit()}
        onCancel={() => setEditing(false)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={save} preserve={false}>
          <Form.Item name="model" label={t('型号')}>
            <AutoComplete
              options={options.model.map((x) => ({ value: x }))}
              showSearch={{ filterOption: (input, o) => String(o?.value ?? '').toUpperCase().includes(input.toUpperCase()) }}
            />
          </Form.Item>
          <Form.Item name="customs_status" label={t('报关状态')}>
            <Select allowClear options={options.customs_status.map((x) => ({ value: x, label: t(x) }))} />
          </Form.Item>
          <Form.Item name="boe_no" label={t('BOE 号')}>
            <Input allowClear autoComplete="off" spellCheck={false} maxLength={60} placeholder="Bill of Entry" />
          </Form.Item>
          <Form.Item name="remark" label={t('备注')}>
            <Input.TextArea rows={2} maxLength={500} />
          </Form.Item>
          <Form.Item name="review_note" label={t('待核实说明')} extra={t('核实清楚后清空这一栏')}>
            <Input.TextArea rows={2} maxLength={500} />
          </Form.Item>
          <Form.Item name="excluded" label={t('不计入库存')} valuePropName="checked" extra={t('打开后这台车不算在库存和报表里')}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Drawer>
  )
}
