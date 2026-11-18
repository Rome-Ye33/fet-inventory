import { ExclamationCircleOutlined, ImportOutlined, ReloadOutlined, ShoppingCartOutlined, SwapOutlined } from '@ant-design/icons'
import { Button, Card, Col, Row, Space, Statistic, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActionTag, MoveStatusTag } from '../components/Tags'
import VehicleDrawer from '../components/VehicleDrawer'
import LinkButton from '../components/LinkButton'
import { useAuth } from '../lib/auth'
import { todayAccra } from '../lib/format'
import { useT } from '../lib/i18n'
import { fetchAll, supabase } from '../lib/supabase'
import type { Movement } from '../lib/supabase'

type LocRow = { location: string; total: number; Passenger: number; Heavy: number; Other: number }
type ByLoc = { current_location: string | null; category: string | null; qty: number | null }

export default function OverviewPage() {
  const t = useT()
  const navigate = useNavigate()
  const { canWrite } = useAuth()
  const [loading, setLoading] = useState(true)
  const [byLoc, setByLoc] = useState<ByLoc[]>([])
  const [monthIn, setMonthIn] = useState(0)
  const [monthSold, setMonthSold] = useState(0)
  const [review, setReview] = useState(0)
  const [recent, setRecent] = useState<Movement[]>([])
  const [drawerVin, setDrawerVin] = useState<string | null>(null)
  const monthStart = todayAccra().slice(0, 8) + '01'

  const load = useCallback(async () => {
    setLoading(true)
    const head = { count: 'exact' as const, head: true }
    const [loc, inb, sold, rev, rec] = await Promise.all([
      fetchAll<ByLoc>(() => supabase.from('stock_by_location').select('current_location, category, qty').order('current_location').order('product_code')),
      supabase.from('movements').select('seq', head).eq('action', 'INBOUND').eq('status', 'ACTIVE').gte('op_date', monthStart),
      supabase.from('movements').select('seq', head).eq('action', 'SOLD').eq('status', 'ACTIVE').gte('op_date', monthStart),
      supabase.from('vehicles').select('id', head).or('excluded.is.true,review_note.not.is.null'),
      supabase.from('movement_log').select('*').order('seq', { ascending: false }).limit(10),
    ])
    setByLoc(loc.data)
    setMonthIn(inb.count ?? 0)
    setMonthSold(sold.count ?? 0)
    setReview(rev.count ?? 0)
    setRecent(rec.data ?? [])
    setLoading(false)
  }, [monthStart])

  useEffect(() => {
    void load()
  }, [load])

  const { locRows, totals } = useMemo(() => {
    const map = new Map<string, LocRow>()
    const totals = { total: 0, Passenger: 0, Heavy: 0, Other: 0 }
    for (const r of byLoc) {
      const name = r.current_location || t('（没有位置）')
      const row = map.get(name) ?? { location: name, total: 0, Passenger: 0, Heavy: 0, Other: 0 }
      const q = Number(r.qty ?? 0)
      const cat = (r.category ?? 'Other') as 'Passenger' | 'Heavy' | 'Other'
      row.total += q
      row[cat] = (row[cat] ?? 0) + q
      totals.total += q
      totals[cat] = (totals[cat] ?? 0) + q
      map.set(name, row)
    }
    return { locRows: [...map.values()].sort((a, b) => b.total - a.total), totals }
  }, [byLoc, t])

  const openLoc = (loc: string) => navigate(`/vehicles?status=In%20Stock&loc=${encodeURIComponent(loc)}`)

  const locColumns: ColumnsType<LocRow> = [
    {
      title: t('位置'),
      dataIndex: 'location',
      render: (v: string) => <LinkButton onClick={() => openLoc(v)}>{v}</LinkButton>,
    },
    { title: t('乘用车'), dataIndex: 'Passenger', align: 'right', width: 90, render: (v: number) => v || '' },
    { title: t('重型车辆'), dataIndex: 'Heavy', align: 'right', width: 90, render: (v: number) => v || '' },
    { title: t('其他'), dataIndex: 'Other', align: 'right', width: 70, render: (v: number) => v || '' },
    { title: t('合计'), dataIndex: 'total', align: 'right', width: 80, render: (v: number) => <strong>{v}</strong> },
  ]

  const recentColumns: ColumnsType<Movement> = [
    { title: t('日期'), dataIndex: 'op_date', width: 100 },
    { title: t('操作'), dataIndex: 'action', width: 70, render: (v: string) => <ActionTag value={v} /> },
    {
      title: t('车架号'),
      dataIndex: 'vin',
      render: (v: string, r) => (
        <div>
          <LinkButton onClick={() => setDrawerVin(v)}>{v}</LinkButton>
          <div className="hint">{[r.brand, r.product_name].filter(Boolean).join(' · ')}</div>
        </div>
      ),
    },
    { title: t('到 / 客户'), dataIndex: 'to_location', ellipsis: true },
    { title: t('状态'), dataIndex: 'status', width: 80, render: (v: string, r) => <MoveStatusTag value={v} reason={r.void_reason} /> },
  ]

  return (
    <div>
      <div className="page-title">
        <h2>{t('概览')}</h2>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => void load()} aria-label={t('刷新')} />
          {canWrite && (
            <>
              <Button icon={<ImportOutlined />} onClick={() => navigate('/entry?tab=inbound')}>
                {t('入库')}
              </Button>
              <Button icon={<ShoppingCartOutlined />} onClick={() => navigate('/entry?tab=sale')}>
                {t('销售')}
              </Button>
              <Button icon={<SwapOutlined />} onClick={() => navigate('/entry?tab=transfer')}>
                {t('调拨')}
              </Button>
            </>
          )}
        </Space>
      </div>
      <Row gutter={[16, 16]} className="kpi-row">
        <Col xs={12} md={8} xl={4}>
          <Card loading={loading} className="kpi-card kpi-main">
            <Statistic title={t('在库总数')} value={totals.total} suffix={t('台')} />
          </Card>
        </Col>
        <Col xs={12} md={8} xl={4}>
          <Card loading={loading} className="kpi-card">
            <Statistic title={t('乘用车')} value={totals.Passenger} suffix={t('台')} />
          </Card>
        </Col>
        <Col xs={12} md={8} xl={4}>
          <Card loading={loading} className="kpi-card">
            <Statistic title={t('重型车辆')} value={totals.Heavy} suffix={t('台')} />
          </Card>
        </Col>
        <Col xs={12} md={8} xl={4}>
          <Card loading={loading} className="kpi-card">
            <Statistic title={t('本月入库')} value={monthIn} suffix={t('台')} />
          </Card>
        </Col>
        <Col xs={12} md={8} xl={4}>
          <Card loading={loading} className="kpi-card">
            <Statistic title={t('本月销售')} value={monthSold} suffix={t('台')} />
          </Card>
        </Col>
        <Col xs={12} md={8} xl={4}>
          <Card loading={loading} className="kpi-card kpi-click" onClick={() => navigate('/vehicles?review=1')}>
            <Statistic
              title={t('待核实')}
              value={review}
              suffix={t('台')}
              prefix={review > 0 ? <ExclamationCircleOutlined className="text-warn" /> : undefined}
            />
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={11}>
          <Card title={t('各位置在库')} size="small">
            <Table<LocRow>
              rowKey="location"
              size="small"
              loading={loading}
              columns={locColumns}
              dataSource={locRows}
              pagination={false}
              summary={() =>
                locRows.length ? (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0}>
                      <strong>{t('合计')}</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      {totals.Passenger}
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right">
                      {totals.Heavy}
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">
                      {totals.Other || ''}
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">
                      <strong>{totals.total}</strong>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                ) : null
              }
            />
          </Card>
        </Col>
        <Col xs={24} xl={13}>
          <Card
            title={t('最近的流水')}
            size="small"
            extra={
              <LinkButton onClick={() => navigate('/movements')}>
                {t('全部流水')}
              </LinkButton>
            }
          >
            <Table<Movement>
              rowKey="seq"
              size="small"
              loading={loading}
              columns={recentColumns}
              dataSource={recent}
              pagination={false}
              scroll={{ x: 560 }}
              rowClassName={(r) => (r.status === 'VOID' ? 'row-void' : '')}
            />
          </Card>
        </Col>
      </Row>
      <VehicleDrawer vin={drawerVin} onClose={() => setDrawerVin(null)} onChanged={() => void load()} />
    </div>
  )
}
