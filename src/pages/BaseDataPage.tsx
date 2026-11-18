import { PlusOutlined } from '@ant-design/icons'
import { App, Button, Card, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tabs, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMemo, useState } from 'react'
import { CategoryTag } from '../components/Tags'
import LinkButton from '../components/LinkButton'
import { useAuth } from '../lib/auth'
import { errorText } from '../lib/errors'
import { money } from '../lib/format'
import { useT } from '../lib/i18n'
import { CATALOG_LABEL, CATALOG_LISTS, CATEGORIES, CATEGORY_LABEL, LOCATION_KIND_LABEL, LOCATION_KINDS } from '../lib/labels'
import type { CatalogList } from '../lib/labels'
import { useRefData } from '../lib/refdata'
import { supabase } from '../lib/supabase'
import type { Location, Product } from '../lib/supabase'

// ---------------- 位置 ----------------

function LocationsTab() {
  const t = useT()
  const { message } = App.useApp()
  const { canWrite } = useAuth()
  const { locations, reload } = useRefData()
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [form] = Form.useForm<{ name: string; kind: string }>()

  const save = async (name: string, kind: string, active: boolean) => {
    setBusy(name)
    const { error } = await supabase.rpc('upsert_location', { p_name: name, p_kind: kind, p_active: active })
    setBusy(null)
    if (error) {
      message.error(errorText(error))
      return false
    }
    await reload()
    return true
  }

  const add = async (v: { name: string; kind: string }) => {
    const name = v.name.trim()
    if (locations.some((l) => l.name.toUpperCase() === name.toUpperCase())) {
      form.setFields([{ name: 'name', errors: [t('这个位置已经存在')] }])
      return
    }
    if (await save(name, v.kind, true)) {
      message.success(t('已添加'))
      setAdding(false)
      form.resetFields()
    }
  }

  const columns: ColumnsType<Location> = [
    { title: t('位置名称'), dataIndex: 'name', render: (v: string, r) => (r.active ? v : <Typography.Text delete>{v}</Typography.Text>) },
    {
      title: t('类型'),
      dataIndex: 'kind',
      width: 150,
      render: (v: string, r) =>
        canWrite ? (
          <Select
            size="small"
            style={{ width: 120 }}
            value={v}
            disabled={busy === r.name}
            onChange={(k: string) => void save(r.name, k, r.active)}
            options={LOCATION_KINDS.map((k) => ({ value: k, label: t(LOCATION_KIND_LABEL[k]) }))}
          />
        ) : (
          t(LOCATION_KIND_LABEL[v] ?? v)
        ),
    },
    {
      title: t('启用'),
      dataIndex: 'active',
      width: 90,
      render: (v: boolean, r) => (
        <Switch size="small" checked={v} disabled={!canWrite} loading={busy === r.name} onChange={(on) => void save(r.name, r.kind, on)} />
      ),
    },
  ]

  return (
    <>
      <div className="tab-head">
        <Typography.Text type="secondary">
          {t('入库、调拨时可选的位置。停用的位置不再出现在下拉框里，已有的记录不受影响。位置名称不能改，因为流水里记的是名称。')}
        </Typography.Text>
        {canWrite && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAdding(true)}>
            {t('新增位置')}
          </Button>
        )}
      </div>
      <Table<Location> rowKey="name" size="small" columns={columns} dataSource={locations} pagination={false} />
      <Modal open={adding} title={t('新增位置')} okText={t('添加')} onOk={() => form.submit()} onCancel={() => setAdding(false)} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={add} initialValues={{ kind: 'branch' }} preserve={false}>
          <Form.Item name="name" label={t('位置名称')} rules={[{ required: true, whitespace: true, message: t('请填位置名称') }]}>
            <Input maxLength={60} autoFocus />
          </Form.Item>
          <Form.Item name="kind" label={t('类型')}>
            <Select options={LOCATION_KINDS.map((k) => ({ value: k, label: t(LOCATION_KIND_LABEL[k]) }))} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

// ---------------- 下拉选项 ----------------

function OptionsTab() {
  const t = useT()
  const { message } = App.useApp()
  const { canWrite } = useAuth()
  const { options, reload } = useRefData()
  const [list, setList] = useState<CatalogList>('brand')
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  // 报关状态是固定的三个，不在这里加
  const editable = canWrite && list !== 'customs_status'

  const add = async () => {
    const v = value.trim()
    if (!v) return
    if (options[list].some((o) => o.toUpperCase() === v.toUpperCase())) {
      message.warning(t('已经有这个选项了'))
      return
    }
    setBusy(true)
    const { error } = await supabase.rpc('add_catalog_option', { p_list: list, p_value: v })
    setBusy(false)
    if (error) return message.error(errorText(error))
    setValue('')
    message.success(t('已添加'))
    void reload()
  }

  return (
    <>
      <div className="tab-head">
        <Typography.Text type="secondary">{t('入库时品牌、品名、型号、颜色的下拉选项。入库时填了新的，会自动加进来。')}</Typography.Text>
      </div>
      <Tabs
        tabPlacement="start"
        activeKey={list}
        onChange={(k) => setList(k as CatalogList)}
        items={CATALOG_LISTS.map((l) => ({
          key: l,
          label: `${t(CATALOG_LABEL[l])} (${options[l].length})`,
          children: (
            <Card size="small">
              {editable && (
                <Space.Compact style={{ width: '100%', maxWidth: 420, marginBottom: 12 }}>
                  <Input
                    placeholder={t('新的{name}', { name: t(CATALOG_LABEL[l]) })}
                    value={value}
                    maxLength={80}
                    onChange={(e) => setValue(e.target.value)}
                    onPressEnter={() => void add()}
                  />
                  <Button type="primary" icon={<PlusOutlined />} loading={busy} onClick={() => void add()}>
                    {t('添加')}
                  </Button>
                </Space.Compact>
              )}
              <div className="option-tags">
                {options[l].map((o) => (
                  <Tag key={o}>{l === 'customs_status' ? t(o) : o}</Tag>
                ))}
              </div>
            </Card>
          ),
        }))}
      />
    </>
  )
}

// ---------------- 产品与单价 ----------------

function ProductsTab() {
  const t = useT()
  const { message } = App.useApp()
  const { canWrite } = useAuth()
  const { products, reload } = useRefData()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string | undefined>()
  const [editing, setEditing] = useState<{ code: string; price: number | null } | null>(null)
  const [busy, setBusy] = useState(false)

  const shown = useMemo(() => {
    const s = q.trim().toUpperCase()
    return products.filter(
      (p) => (!cat || p.category === cat) && (!s || [p.code, p.brand, p.product_name, p.color].join(' ').toUpperCase().includes(s)),
    )
  }, [products, q, cat])

  const save = async () => {
    if (!editing) return
    setBusy(true)
    const { error } = await supabase.rpc('set_product_price', { p_code: editing.code, p_price_usd: editing.price as number })
    setBusy(false)
    if (error) return message.error(errorText(error))
    message.success(t('已保存'))
    setEditing(null)
    void reload()
  }

  const columns: ColumnsType<Product> = [
    { title: t('产品编码'), dataIndex: 'code', width: 112 },
    { title: t('类别'), dataIndex: 'category', width: 96, render: (v: string) => <CategoryTag value={v} /> },
    { title: t('品牌'), dataIndex: 'brand', width: 150, ellipsis: true },
    { title: t('品名'), dataIndex: 'product_name', ellipsis: true },
    { title: t('颜色'), dataIndex: 'color', width: 130, ellipsis: true },
    {
      title: t('单价（美元）'),
      dataIndex: 'price_usd',
      width: 140,
      align: 'right',
      render: (v: number | null, r) =>
        editing?.code === r.code ? (
          <Space.Compact size="small">
            <InputNumber
              size="small"
              autoFocus
              min={0}
              precision={2}
              style={{ width: 100 }}
              value={editing.price}
              onChange={(x) => setEditing({ code: r.code, price: x })}
              onPressEnter={() => void save()}
            />
            <Button size="small" type="primary" loading={busy} onClick={() => void save()}>
              {t('保存')}
            </Button>
          </Space.Compact>
        ) : canWrite ? (
          <LinkButton onClick={() => setEditing({ code: r.code, price: v })}>{v == null ? t('设置') : money(v, 0)}</LinkButton>
        ) : (
          <span className="num">{v == null ? '' : money(v, 0)}</span>
        ),
    },
  ]

  return (
    <>
      <div className="tab-head">
        <Space wrap>
          <Input.Search allowClear placeholder={t('编码、品牌、品名、颜色')} style={{ width: 240 }} onSearch={setQ} onChange={(e) => !e.target.value && setQ('')} />
          <Select
            allowClear
            placeholder={t('类别')}
            style={{ width: 120 }}
            value={cat}
            onChange={setCat}
            options={CATEGORIES.map((c) => ({ value: c, label: t(CATEGORY_LABEL[c]) }))}
          />
        </Space>
        <Typography.Text type="secondary">{t('产品编码在入库时自动生成：类别、品牌、品名、颜色一样就是同一个产品。')}</Typography.Text>
      </div>
      <Table<Product>
        rowKey="code"
        size="small"
        columns={columns}
        dataSource={shown}
        scroll={{ x: 800 }}
        pagination={{ defaultPageSize: 50, showSizeChanger: true }}
      />
    </>
  )
}

export default function BaseDataPage() {
  const t = useT()
  return (
    <div>
      <div className="page-title">
        <h2>{t('基础资料')}</h2>
      </div>
      <Card>
        <Tabs
          items={[
            { key: 'loc', label: t('位置'), children: <LocationsTab /> },
            { key: 'opt', label: t('下拉选项'), children: <OptionsTab /> },
            { key: 'prod', label: t('产品与单价'), children: <ProductsTab /> },
          ]}
        />
      </Card>
    </div>
  )
}
