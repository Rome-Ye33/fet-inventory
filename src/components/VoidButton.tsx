import { StopOutlined } from '@ant-design/icons'
import { Alert, App, Button, Form, Input, Modal } from 'antd'
import { useState } from 'react'
import { errorText } from '../lib/errors'
import { useT } from '../lib/i18n'
import { ACTION_LABEL } from '../lib/labels'
import { supabase } from '../lib/supabase'

type Target = { seq: number | null; action: string | null; vin: string | null; op_date?: string | null }

/** 作废一条流水（要写原因）。作废入库会把这台车之后的销售、调拨一起作废，和 Excel 一样 */
export default function VoidButton({
  move,
  onDone,
  type = 'link',
  block,
}: {
  move: Target
  onDone: () => void
  type?: 'link' | 'default' | 'primary'
  block?: boolean
}) {
  const t = useT()
  const { message } = App.useApp()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form] = Form.useForm<{ reason: string }>()

  const submit = async ({ reason }: { reason: string }) => {
    if (move.seq == null) return
    setBusy(true)
    const { data, error } = await supabase.rpc('void_movement', { p_seq: move.seq, p_reason: reason.trim() })
    setBusy(false)
    if (error) return message.error(errorText(error))
    message.success(data && data > 1 ? t('已作废 {n} 条流水（含连带作废的销售、调拨）', { n: data }) : t('已作废'))
    setOpen(false)
    form.resetFields()
    onDone()
  }

  return (
    <>
      <Button
        size={type === 'link' ? 'small' : undefined}
        type={type}
        danger
        block={block}
        icon={type === 'link' ? undefined : <StopOutlined />}
        onClick={() => setOpen(true)}
      >
        {t('作废')}
      </Button>
      <Modal
        open={open}
        title={t('作废流水 {seq}', { seq: move.seq ?? '' })}
        okText={t('确认作废')}
        okButtonProps={{ danger: true }}
        confirmLoading={busy}
        onOk={() => form.submit()}
        onCancel={() => setOpen(false)}
        destroyOnHidden
      >
        <p>
          {move.vin} · {t(ACTION_LABEL[move.action ?? ''] ?? move.action ?? '')}
          {move.op_date ? ` · ${move.op_date}` : ''}
        </p>
        {move.action === 'INBOUND' && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            title={t('作废入库会把这台车之后的销售、调拨一起作废，这台车不再算库存。')}
          />
        )}
        <Form form={form} layout="vertical" preserve={false} onFinish={submit}>
          <Form.Item name="reason" label={t('作废原因')} rules={[{ required: true, whitespace: true, message: t('请写作废原因') }]}>
            <Input.TextArea rows={2} maxLength={200} autoFocus />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
