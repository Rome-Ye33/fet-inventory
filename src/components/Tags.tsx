import { Tag, Tooltip } from 'antd'
import { useT } from '../lib/i18n'
import {
  ACTION_COLOR,
  ACTION_LABEL,
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  CUSTOMS_COLOR,
  MOVE_STATUS_LABEL,
  STOCK_STATUS_COLOR,
  STOCK_STATUS_LABEL,
} from '../lib/labels'
import { trServer } from '../lib/i18n'

type V = { value: string | null | undefined }

export function CategoryTag({ value }: V) {
  const t = useT()
  if (!value) return null
  return <Tag color={CATEGORY_COLOR[value]}>{t(CATEGORY_LABEL[value] ?? value)}</Tag>
}

export function ActionTag({ value }: V) {
  const t = useT()
  if (!value) return null
  return <Tag color={ACTION_COLOR[value]}>{t(ACTION_LABEL[value] ?? value)}</Tag>
}

export function StockStatusTag({ value }: V) {
  const t = useT()
  if (!value) return null
  return <Tag color={STOCK_STATUS_COLOR[value]}>{t(STOCK_STATUS_LABEL[value] ?? value)}</Tag>
}

export function CustomsTag({ value }: V) {
  const t = useT()
  if (!value) return null
  return <Tag color={CUSTOMS_COLOR[value]}>{t(value)}</Tag>
}

/** 流水状态：作废的带上原因 */
export function MoveStatusTag({ value, reason }: V & { reason?: string | null }) {
  const t = useT()
  if (!value) return null
  if (value === 'VOID') {
    const tag = <Tag color="red">{t(MOVE_STATUS_LABEL.VOID)}</Tag>
    return reason ? <Tooltip title={trServer(reason)}>{tag}</Tooltip> : tag
  }
  return <Tag color="green">{t(MOVE_STATUS_LABEL[value] ?? value)}</Tag>
}

/** 不计入库存（导入时核对不上的车） */
export function ExcludedTag() {
  const t = useT()
  return <Tag color="volcano">{t('不计库存')}</Tag>
}
