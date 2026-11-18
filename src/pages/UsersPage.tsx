import { DeleteOutlined, KeyOutlined, ReloadOutlined, UserAddOutlined } from '@ant-design/icons'
import { App, Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useState } from 'react'
import { accountCall, MIN_PASSWORD, randomPassword } from '../lib/account'
import { ROLE_COLOR, ROLE_LABEL, useAuth } from '../lib/auth'
import { errorText } from '../lib/errors'
import { dateTime } from '../lib/format'
import { useT } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import type { AppUser, Invite, Role } from '../lib/supabase'

const ROLES: Role[] = ['admin', 'staff', 'viewer']
const ROLE_HINT: Record<Role, string> = {
  admin: '全部功能，还能管理用户',
  staff: '能录入入库、销售、调拨，能改基础资料',
  viewer: '只能查看',
}

export default function UsersPage() {
  const t = useT()
  const { message, modal } = App.useApp()
  const { session } = useAuth()
  const myId = session?.user.id
  const [users, setUsers] = useState<AppUser[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [pwUser, setPwUser] = useState<AppUser | null>(null)
  const [pwBusy, setPwBusy] = useState(false)
  const [iform] = Form.useForm<{ email: string; role: Role }>()
  const [pform] = Form.useForm<{ password: string }>()

  const load = useCallback(async () => {
    setLoading(true)
    const [u, i] = await Promise.all([
      supabase.from('app_users').select('*').order('active', { ascending: false }).order('created_at'),
      supabase.rpc('list_invites'),
    ])
    setUsers(u.data ?? [])
    setInvites(i.data ?? [])
    setLoading(false)
    if (u.error || i.error) message.error(errorText(u.error ?? i.error))
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const roleOptions = ROLES.map((r) => ({ value: r, label: `${t(ROLE_LABEL[r])} · ${t(ROLE_HINT[r])}` }))

  const setAccess = async (email: string, role: string, active: boolean) => {
    setBusy(email)
    const { error } = await supabase.rpc('set_user_access', { p_email: email, p_role: role, p_active: active })
    setBusy(null)
    if (error) {
      message.error(errorText(error))
      return false
    }
    void load()
    return true
  }

  const saveInvite = async () => {
    const v = await iform.validateFields()
    const email = v.email.trim().toLowerCase()
    const registered = users.some((u) => u.email?.toLowerCase() === email)
    if (await setAccess(email, v.role, true)) {
      message.success(registered ? t('这个邮箱已经注册过，已按新的角色开通') : t('已加入邀请名单，让对方用这个邮箱在登录页“第一次使用”里设置密码'))
      setInviteOpen(false)
      iform.resetFields()
    }
  }

  const savePassword = async () => {
    const v = await pform.validateFields()
    if (!pwUser) return
    setPwBusy(true)
    try {
      await accountCall({ action: 'set_password', user_id: pwUser.user_id, password: v.password })
    } catch (e) {
      setPwBusy(false)
      return message.error(errorText(e))
    }
    setPwBusy(false)
    modal.success({
      title: t('密码已重设'),
      content: (
        <div>
          {t('把新密码告诉 {name}：', { name: pwUser.full_name || pwUser.email || '' })}
          <Typography.Paragraph copyable strong style={{ fontSize: 16, marginTop: 8 }}>
            {v.password}
          </Typography.Paragraph>
        </div>
      ),
    })
    setPwUser(null)
  }

  const removeUser = async (u: AppUser) => {
    setBusy(u.email ?? u.user_id)
    try {
      await accountCall({ action: 'delete_user', user_id: u.user_id })
    } catch (e) {
      setBusy(null)
      return message.error(errorText(e))
    }
    setBusy(null)
    message.success(t('已删除账号'))
    void load()
  }

  const userColumns: ColumnsType<AppUser> = [
    {
      title: t('姓名'),
      dataIndex: 'full_name',
      width: 140,
      render: (v: string | null, r) => (
        <Space size={4}>
          {v || <span className="hint">—</span>}
          {r.user_id === myId && <Tag>{t('我')}</Tag>}
        </Space>
      ),
    },
    { title: t('邮箱'), dataIndex: 'email', width: 230, ellipsis: true },
    {
      title: t('角色'),
      dataIndex: 'role',
      width: 140,
      render: (v: Role, r) => (
        <Select
          size="small"
          style={{ width: 120 }}
          value={v}
          disabled={r.user_id === myId || busy === r.email}
          onChange={(role: string) => r.email && void setAccess(r.email, role, r.active)}
          options={ROLES.map((x) => ({ value: x, label: t(ROLE_LABEL[x]) }))}
        />
      ),
    },
    {
      title: t('启用'),
      dataIndex: 'active',
      width: 80,
      render: (v: boolean, r) => (
        <Switch
          size="small"
          checked={v}
          disabled={r.user_id === myId}
          loading={busy === r.email}
          onChange={(on) => r.email && void setAccess(r.email, r.role, on)}
        />
      ),
    },
    { title: t('注册时间'), dataIndex: 'created_at', width: 150, render: (v: string) => dateTime(v) },
    {
      title: t('操作'),
      key: 'op',
      width: 200,
      render: (_, r) =>
        r.user_id === myId ? null : (
          <Space size={4}>
            <Button
              size="small"
              icon={<KeyOutlined />}
              onClick={() => {
                pform.setFieldsValue({ password: randomPassword() })
                setPwUser(r)
              }}
            >
              {t('重设密码')}
            </Button>
            <Popconfirm
              title={t('删除这个账号？录过数据的账号不能删，只能停用。')}
              okText={t('删除')}
              okButtonProps={{ danger: true }}
              onConfirm={() => void removeUser(r)}
            >
              <Button size="small" danger icon={<DeleteOutlined />} aria-label={t('删除')} />
            </Popconfirm>
          </Space>
        ),
    },
  ]

  const pending = invites.filter((i) => !i.registered)

  const inviteColumns: ColumnsType<Invite> = [
    { title: t('邮箱'), dataIndex: 'email', width: 260, ellipsis: true },
    { title: t('角色'), dataIndex: 'role', width: 110, render: (v: Role) => <Tag color={ROLE_COLOR[v]}>{t(ROLE_LABEL[v] ?? v)}</Tag> },
    {
      title: t('状态'),
      dataIndex: 'active',
      width: 110,
      render: (v: boolean) => (v ? <Tag color="gold">{t('等待注册')}</Tag> : <Tag>{t('已取消')}</Tag>),
    },
    { title: t('加入时间'), dataIndex: 'created_at', width: 150, render: (v: string) => dateTime(v) },
    {
      title: t('操作'),
      key: 'op',
      render: (_, r) =>
        r.active ? (
          <Popconfirm title={t('取消对 {email} 的邀请？', { email: r.email })} okText={t('取消邀请')} onConfirm={() => void setAccess(r.email, r.role, false)}>
            <Button size="small" loading={busy === r.email}>
              {t('取消邀请')}
            </Button>
          </Popconfirm>
        ) : (
          <Button size="small" loading={busy === r.email} onClick={() => void setAccess(r.email, r.role, true)}>
            {t('恢复邀请')}
          </Button>
        ),
    },
  ]

  return (
    <div>
      <div className="page-title">
        <h2>{t('用户与权限')}</h2>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => void load()} aria-label={t('刷新')} />
          <Button type="primary" icon={<UserAddOutlined />} onClick={() => setInviteOpen(true)}>
            {t('邀请新用户')}
          </Button>
        </Space>
      </div>
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Card title={t('账号')} size="small">
          <Table<AppUser>
            rowKey="user_id"
            size="small"
            loading={loading}
            columns={userColumns}
            dataSource={users}
            pagination={false}
            scroll={{ x: 960 }}
          />
          <div className="hint" style={{ marginTop: 8 }}>
            {t('不在邀请名单上的人自己注册了也进不来（会显示为停用），要用的话在这里开通。')}
          </div>
        </Card>
        <Card title={t('邀请名单（还没注册的）')} size="small">
          <Table<Invite>
            rowKey="email"
            size="small"
            loading={loading}
            columns={inviteColumns}
            dataSource={pending}
            pagination={false}
            scroll={{ x: 760 }}
            locale={{ emptyText: t('没有等待注册的邀请') }}
          />
        </Card>
      </Space>
      <Modal
        open={inviteOpen}
        title={t('邀请新用户')}
        okText={t('加入邀请名单')}
        onOk={() => void saveInvite()}
        onCancel={() => setInviteOpen(false)}
        forceRender
      >
        <Form form={iform} layout="vertical" initialValues={{ role: 'staff' }}>
          <Form.Item name="email" label={t('邮箱')} rules={[{ required: true, type: 'email', message: t('请填正确的邮箱') }]}>
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="role" label={t('角色')} rules={[{ required: true }]}>
            <Select options={roleOptions} />
          </Form.Item>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t('加入后，对方打开网站，在“第一次使用”里用这个邮箱设置密码就能用，不用收邮件。')}
          </Typography.Paragraph>
        </Form>
      </Modal>
      <Modal
        open={!!pwUser}
        title={t('重设密码：{name}', { name: pwUser?.full_name || pwUser?.email || '' })}
        okText={t('重设')}
        confirmLoading={pwBusy}
        onOk={() => void savePassword()}
        onCancel={() => setPwUser(null)}
        forceRender
      >
        <Form form={pform} layout="vertical">
          <Form.Item label={t('新密码（已经随机生成一个，也可以自己改）')} required extra={t('重设后把新密码告诉对方，对方用它登录。')}>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item
                name="password"
                noStyle
                rules={[
                  { required: true, min: MIN_PASSWORD, message: t('密码至少 {MIN_PASSWORD} 位', { MIN_PASSWORD }) },
                  { max: 72, message: t('密码最多 72 位') },
                ]}
              >
                <Input autoComplete="off" />
              </Form.Item>
              <Button onClick={() => pform.setFieldsValue({ password: randomPassword() })}>{t('换一个')}</Button>
            </Space.Compact>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
