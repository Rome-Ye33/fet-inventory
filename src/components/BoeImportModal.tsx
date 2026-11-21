import { DownloadOutlined, InboxOutlined } from '@ant-design/icons'
import { Alert, App, Button, Modal, Segmented, Select, Space, Spin, Table, Tag, Upload } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMemo, useState } from 'react'
import { parseBoeFile, previewBoe, willChange } from '../lib/boe'
import type { BoeSheet, Outcome, Preview } from '../lib/boe'
import { errorText } from '../lib/errors'
import { exportXlsx, xlsxName } from '../lib/excel'
import { todayAccra } from '../lib/format'
import { useT } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import type { Stock } from '../lib/supabase'
import { CustomsTag } from './Tags'

const ORDER: Outcome[] = ['paid', 'paid_fill', 'bonded', 'bonded_fill', 'unchanged', 'missing']
const OUTCOME_LABEL: Record<Outcome, string> = {
  paid: '改成已完税',
  paid_fill: '补完税 BOE 号',
  bonded: '记保税仓 BOE 号',
  bonded_fill: '补保税仓 BOE 号',
  unchanged: '没有变化',
  missing: '系统里没有',
}
const OUTCOME_COLOR: Record<Outcome, string> = { paid: 'green', paid_fill: 'cyan', bonded: 'orange', bonded_fill: 'gold', unchanged: 'default', missing: 'red' }

/** 导入 BOE 表：选文件 → 看每台车会怎么改 → 确认更新 */
export default function BoeImportModal({ open, vehicles, onClose, onDone }: { open: boolean; vehicles: Stock[]; onClose: () => void; onDone: () => void }) {
  const t = useT()
  const { message } = App.useApp()
  const [fileName, setFileName] = useState('')
  const [sheets, setSheets] = useState<BoeSheet[]>([])
  const [sheetName, setSheetName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [error, setError] = useState('')

  const sheet = sheets.find((s) => s.name === sheetName) ?? sheets[0]
  const preview = useMemo(() => (sheet ? previewBoe(sheet.entries, vehicles) : []), [sheet, vehicles])
  const counts = useMemo(() => {
    const c = Object.fromEntries(ORDER.map((o) => [o, 0])) as Record<Outcome, number>
    for (const p of preview) c[p.outcome]++
    return c
  }, [preview])
  const changes = preview.filter(willChange)
  const shown = filter === 'all' ? preview : preview.filter((p) => p.outcome === filter)

  const close = () => {
    setFileName('')
    setSheets([])
    setSheetName('')
    setFilter('all')
    setError('')
    onClose()
  }

  const pick = async (file: File) => {
    setParsing(true)
    setError('')
    setFilter('all')
    try {
      const parsed = await parseBoeFile(file)
      setFileName(file.name)
      setSheets(parsed)
      setSheetName(parsed[0]?.name ?? '')
      if (!parsed.length) setError(t('这个文件里没有找到“大架号”和 BOE 号的列'))
    } catch (e) {
      setError(errorText(e))
    }
    setParsing(false)
  }

  const apply = async () => {
    setApplying(true)
    const { data, error } = await supabase.rpc('import_boe', { p_rows: changes.map((p) => ({ vin: p.vin, paid: p.paid, bonded: p.bonded })) })
    setApplying(false)
    if (error) return message.error(errorText(error))
    const r = (data ?? {}) as { updated?: number; unchanged?: number; not_found?: string[] }
    message.success(t('已更新 {n} 台，{m} 台没有变化', { n: r.updated ?? 0, m: r.unchanged ?? 0 }))
    close()
    onDone()
  }

  const exportList = () =>
    exportXlsx(xlsxName(t('BOE 核对清单'), todayAccra()), [
      {
        name: t('BOE 核对清单'),
        rows: preview.map((p) => ({
          [t('车架号')]: p.vin,
          [t('结果')]: t(OUTCOME_LABEL[p.outcome]),
          [t('表里的完税 BOE 号')]: p.paid,
          [t('表里的保税仓 BOE 号')]: p.bonded,
          [t('表里的日期')]: p.date,
          [t('系统里的报关状态')]: p.vehicle?.customs_status ? t(p.vehicle.customs_status) : '',
          [t('系统里的完税 BOE 号')]: p.vehicle?.boe_no ?? '',
          [t('系统里的保税仓 BOE 号')]: p.vehicle?.bonded_boe_no ?? '',
          [t('品牌')]: p.vehicle?.brand ?? '',
          [t('品名')]: p.vehicle?.product_name ?? '',
          [t('当前位置')]: p.vehicle?.current_location ?? '',
        })),
      },
    ])

  const columns: ColumnsType<Preview> = [
    { title: t('车架号'), dataIndex: 'vin', width: 180 },
    { title: t('结果'), dataIndex: 'outcome', width: 140, render: (o: Outcome) => <Tag color={OUTCOME_COLOR[o]}>{t(OUTCOME_LABEL[o])}</Tag> },
    {
      title: t('系统里的'),
      key: 'sys',
      ellipsis: true,
      render: (_, p) =>
        p.vehicle ? (
          <Space size={4} wrap>
            <CustomsTag value={p.vehicle.customs_status} />
            <span className="hint">
              {[p.vehicle.brand, p.vehicle.product_name, p.vehicle.current_location].filter(Boolean).join(' · ')}
              {p.vehicle.boe_no ? ` · ${p.vehicle.boe_no}` : ''}
            </span>
          </Space>
        ) : (
          ''
        ),
    },
    {
      title: t('表里的'),
      key: 'sheet',
      ellipsis: true,
      render: (_, p) => [p.paid && `${t('完税 BOE')} ${p.paid}`, p.bonded && `${t('保税仓 BOE')} ${p.bonded}`, p.date].filter(Boolean).join(' · '),
    },
  ]

  return (
    <Modal
      open={open}
      title={t('导入 BOE 表')}
      width={960}
      onCancel={close}
      destroyOnHidden
      footer={[
        <Button key="export" icon={<DownloadOutlined />} onClick={() => void exportList()} disabled={!preview.length}>
          {t('导出核对清单')}
        </Button>,
        <Button key="cancel" onClick={close}>
          {t('取消')}
        </Button>,
        <Button key="ok" type="primary" loading={applying} disabled={!changes.length} onClick={() => void apply()}>
          {t('确认更新 {n} 台', { n: changes.length })}
        </Button>,
      ]}
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Upload.Dragger
          accept=".xlsx,.xls,.xlsm"
          showUploadList={false}
          maxCount={1}
          beforeUpload={(f) => {
            void pick(f)
            return false
          }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">{fileName || t('把 BOE 表拖到这里，或点击选择')}</p>
          <p className="ant-upload-hint">
            {t('按“大架号”列找到系统里的车：有完税 BOE 号的改成已完税并记下号码；只有保税仓 BOE 号的记下号码，还没完税的记为未缴纳。表里的类型、款式不用；只补不清，系统里没有的车不会新建。')}
          </p>
        </Upload.Dragger>
        {error && <Alert type="error" showIcon title={error} />}
        <Spin spinning={parsing}>
          {sheet && (
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              <Space wrap>
                {sheets.length > 1 && <Select value={sheet.name} onChange={setSheetName} style={{ width: 220 }} options={sheets.map((s) => ({ value: s.name, label: s.name }))} />}
                <span>
                  {t('表里 {rows} 行、{vins} 台车，系统里找到 {found} 台', { rows: sheet.rows, vins: sheet.entries.length + sheet.noBoe, found: preview.length - counts.missing })}
                  {sheet.noBoe ? `，${t('{n} 台没有 BOE 号，跳过', { n: sheet.noBoe })}` : ''}
                </span>
              </Space>
              <Segmented<string>
                value={filter}
                onChange={setFilter}
                options={[{ value: 'all', label: `${t('全部')} ${preview.length}` }, ...ORDER.map((o) => ({ value: o, label: `${t(OUTCOME_LABEL[o])} ${counts[o]}` }))]}
              />
              <Table<Preview> rowKey="vin" size="small" columns={columns} dataSource={shown} pagination={{ pageSize: 20, showSizeChanger: false }} scroll={{ x: 760 }} />
            </Space>
          )}
        </Spin>
      </Space>
    </Modal>
  )
}
