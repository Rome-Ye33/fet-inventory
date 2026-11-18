// 数据库里存的英文代码 → 界面上的中文（英文界面再经 t() 翻成英文，见 src/i18n/en.ts 的 VALUES）

export const CATEGORIES = ['Passenger', 'Heavy', 'Other'] as const
export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_LABEL: Record<string, string> = {
  Passenger: '乘用车',
  Heavy: '重型车辆',
  Other: '其他',
}
export const CATEGORY_COLOR: Record<string, string> = { Passenger: 'blue', Heavy: 'orange', Other: 'default' }
/** 产品编码前缀：FETV 乘用车、FETH 重型车辆、FETO 其他 */
export const CATEGORY_PREFIX: Record<string, string> = { Passenger: 'FETV', Heavy: 'FETH', Other: 'FETO' }

export const ACTION_LABEL: Record<string, string> = {
  INBOUND: '入库',
  SOLD: '销售',
  TRANSFER: '调拨',
}
export const ACTION_COLOR: Record<string, string> = { INBOUND: 'green', SOLD: 'blue', TRANSFER: 'purple' }

/** 每台车的库存状态（视图 vehicle_stock.stock_status） */
export const STOCK_STATUS_LABEL: Record<string, string> = {
  'In Stock': '在库',
  'Out of Stock': '已售出',
  Void: '入库已作废',
}
export const STOCK_STATUS_COLOR: Record<string, string> = { 'In Stock': 'green', 'Out of Stock': 'default', Void: 'red' }

/** 流水状态 */
export const MOVE_STATUS_LABEL: Record<string, string> = { ACTIVE: '有效', VOID: '已作废' }

/** 报关状态（数据库里直接存中文） */
export const CUSTOMS_COLOR: Record<string, string> = { 已完税: 'green', 未缴纳: 'orange', 不详: 'default' }

export const LOCATION_KINDS = ['branch', 'warehouse', 'partner', 'other'] as const
export const LOCATION_KIND_LABEL: Record<string, string> = {
  branch: '分部',
  warehouse: '仓库',
  partner: '合作方',
  other: '其他',
}

/** 下拉选项的几张单子（catalog_options.list） */
export const CATALOG_LISTS = ['brand', 'product_name', 'model', 'color', 'customs_status'] as const
export type CatalogList = (typeof CATALOG_LISTS)[number]
export const CATALOG_LABEL: Record<CatalogList, string> = {
  brand: '品牌',
  product_name: '品名',
  model: '型号',
  color: '颜色',
  customs_status: '报关状态',
}
