import {
  BarChartOutlined,
  CarOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  EditOutlined,
  HistoryOutlined,
  LogoutOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Avatar, Button, Layout, Menu, Result, Space, Spin, Tag, Typography } from 'antd'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import ChangePassword from './components/ChangePassword'
import LangSwitch from './components/LangSwitch'
import Logo from './components/Logo'
import { ROLE_COLOR, ROLE_LABEL, useAuth } from './lib/auth'
import { useI18n } from './lib/i18n'
import LoginPage from './pages/LoginPage'

const OverviewPage = lazy(() => import('./pages/OverviewPage'))
const EntryPage = lazy(() => import('./pages/EntryPage'))
const VehiclesPage = lazy(() => import('./pages/VehiclesPage'))
const ReportPage = lazy(() => import('./pages/ReportPage'))
const MovementsPage = lazy(() => import('./pages/MovementsPage'))
const BaseDataPage = lazy(() => import('./pages/BaseDataPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))

const { Sider, Header, Content } = Layout

function FullSpin() {
  return (
    <div style={{ height: '100%', minHeight: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spin size="large" />
    </div>
  )
}

export default function App() {
  const auth = useAuth()
  const { t, lang, bindUser } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  // 窄屏（手机、平板竖着）时菜单盖在页面上面，点旁边的灰色区域收起
  const [narrow, setNarrow] = useState(false)
  const uid = auth.session?.user.id ?? null

  // 登录后换成这个人上次选的语言
  useEffect(() => {
    bindUser(uid)
  }, [uid, bindUser])

  if (auth.loading) return <FullSpin />
  if (!auth.session) return <LoginPage />
  if (!auth.role) {
    return (
      <Result
        status="403"
        title={t('账号还没有开通')}
        subTitle={t('{email} 已登录，但还没有分配角色或已停用，请联系管理员。', { email: auth.session.user.email ?? '' })}
        extra={
          <Space>
            <LangSwitch />
            <Button onClick={() => void auth.signOut()}>{t('退出登录')}</Button>
          </Space>
        }
      />
    )
  }

  const home = '/overview'
  const items = [
    { key: '/overview', icon: <DashboardOutlined />, label: t('概览') },
    ...(auth.canWrite ? [{ key: '/entry', icon: <EditOutlined />, label: t('录入') }] : []),
    { key: '/vehicles', icon: <CarOutlined />, label: t('车辆查询') },
    { key: '/report', icon: <BarChartOutlined />, label: t('库存报表') },
    { key: '/movements', icon: <HistoryOutlined />, label: t('流水') },
    { key: '/base', icon: <DatabaseOutlined />, label: t('基础资料') },
    ...(auth.isAdmin ? [{ key: '/users', icon: <TeamOutlined />, label: t('用户与权限') }] : []),
  ]

  const selected = items.find((i) => location.pathname.startsWith(i.key))?.key ?? home
  const me = auth.me?.full_name || auth.session.user.email || ''
  const initial = ([...me][0] ?? '').toUpperCase()

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        className="app-sider"
        breakpoint="lg"
        collapsedWidth={0}
        collapsed={collapsed}
        onCollapse={setCollapsed}
        onBreakpoint={setNarrow}
        width={lang === 'en' ? 228 : 208}
      >
        <div className="app-logo">
          <Logo />
        </div>
        <Menu
          theme="dark"
          mode="inline"
          inlineIndent={16}
          selectedKeys={[selected]}
          items={items}
          onClick={(e) => {
            navigate(e.key)
            if (window.innerWidth < 992) setCollapsed(true)
          }}
        />
      </Sider>
      {narrow && !collapsed && <div className="app-sider-mask" onClick={() => setCollapsed(true)} />}
      <Layout>
        <Header className="app-header">
          <span />
          <Space size={8} wrap={false}>
            <LangSwitch />
            <span className="header-user">
              <Avatar size={28} className="header-avatar">
                {initial}
              </Avatar>
              <Typography.Text className="header-name" ellipsis>
                {me}
              </Typography.Text>
            </span>
            <Tag color={ROLE_COLOR[auth.role]} style={{ marginInlineEnd: 0 }}>
              {t(ROLE_LABEL[auth.role])}
            </Tag>
            <ChangePassword />
            <Button type="text" icon={<LogoutOutlined />} onClick={() => void auth.signOut()}>
              <span className="header-logout">{t('退出')}</span>
            </Button>
          </Space>
        </Header>
        <Content className="app-content">
          <div className="app-page">
            <Suspense fallback={<FullSpin />}>
              <Routes>
                <Route path="/overview" element={<OverviewPage />} />
                {auth.canWrite && <Route path="/entry" element={<EntryPage />} />}
                <Route path="/vehicles" element={<VehiclesPage />} />
                <Route path="/report" element={<ReportPage />} />
                <Route path="/movements" element={<MovementsPage />} />
                <Route path="/base" element={<BaseDataPage />} />
                {auth.isAdmin && <Route path="/users" element={<UsersPage />} />}
                <Route path="*" element={<Navigate to={home} replace />} />
              </Routes>
            </Suspense>
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
