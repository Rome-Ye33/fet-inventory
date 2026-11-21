// 导入 BOE 表：读 Excel（报关表里合并单元格很多），按“大架号”对上系统里的车，算出每台车要改成什么。
// 规则和数据库函数 import_boe 一样：有完税 BOE 号 → 已完税并记下号码；只有保税仓 BOE 号 → 记下号码，还没完税的记为未缴纳；只补不清。
import type { Stock } from './supabase'
import { normVin } from './vin'

export type BoeEntry = { vin: string; paid: string | null; bonded: string | null; date: string }
export type BoeSheet = { name: string; rows: number; noBoe: number; entries: BoeEntry[] }
export type Outcome = 'paid' | 'paid_fill' | 'bonded' | 'bonded_fill' | 'unchanged' | 'missing'
export type Preview = BoeEntry & { outcome: Outcome; vehicle: Stock | null }

// 单元格里找 BOE 号：10~14 位数字，后面可以带 -0001 这样的项号；“1”“10台”“/”这些都不算
const BOE_RE = /\d{10,14}(?:\s*-\s*\d{1,4})?/
export const extractBoe = (s: string): string | null => {
  const m = BOE_RE.exec(s)
  return m ? m[0].replace(/\s*-\s*/, '-') : null
}

const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

type Cell = { v?: unknown } | undefined

export async function parseBoeFile(file: File): Promise<BoeSheet[]> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
  const out: BoeSheet[] = []
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    const ref = ws?.['!ref']
    if (!ref) continue
    const range = XLSX.utils.decode_range(ref)
    const raw = (r: number, c: number): Cell => ws[XLSX.utils.encode_cell({ r, c })] as Cell
    // 合并的格子都算左上角那个值（日期、BOE 号常常是一组车合并起来写一次）
    const merged = new Map<string, Cell>()
    for (const m of ws['!merges'] ?? []) {
      const top = raw(m.s.r, m.s.c)
      for (let r = m.s.r; r <= m.e.r; r++) for (let c = m.s.c; c <= m.e.c; c++) merged.set(`${r},${c}`, top)
    }
    const text = (r: number, c: number) => {
      const k = `${r},${c}`
      const v = (merged.has(k) ? merged.get(k) : raw(r, c))?.v
      if (v == null) return ''
      if (v instanceof Date) return isoDate(v)
      return String(v).trim()
    }
    // 表头：前 10 行里有“大架号 / 车架号 / VIN”的那一行
    let header = -1
    for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 10) && header < 0; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        if (/大架号|车架号|VIN/i.test(text(r, c).replace(/\s/g, ''))) {
          header = r
          break
        }
      }
    }
    if (header < 0) continue
    const cols: { vin?: number; paid?: number; bonded?: number; date?: number } = {}
    let anyBoe: number | undefined
    for (let c = range.s.c; c <= range.e.c; c++) {
      const h = text(header, c).replace(/\s/g, '')
      if (!h) continue
      if (cols.vin == null && /大架号|车架号|VIN/i.test(h)) cols.vin = c
      else if (/BOE/i.test(h) && /保税/.test(h)) cols.bonded = c
      else if (/BOE/i.test(h) && /完税/.test(h)) cols.paid = c
      else if (/BOE/i.test(h) && anyBoe == null) anyBoe = c
      else if (cols.date == null && /日期|DATE/i.test(h)) cols.date = c
    }
    // 只有一列 BOE 号（没写明完税还是保税仓）就当完税的
    if (cols.paid == null && cols.bonded == null) cols.paid = anyBoe
    if (cols.vin == null || (cols.paid == null && cols.bonded == null)) continue

    const map = new Map<string, BoeEntry & { pd: string; bd: string }>()
    let rows = 0
    for (let r = header + 1; r <= range.e.r; r++) {
      const vin = normVin(text(r, cols.vin))
      // 配件、发电机这些不是车的行跳过
      if (!/^[A-Z0-9-]{8,}$/.test(vin)) continue
      rows++
      const paid = cols.paid == null ? null : extractBoe(text(r, cols.paid))
      const bonded = cols.bonded == null ? null : extractBoe(text(r, cols.bonded))
      const date = cols.date == null ? '' : text(r, cols.date).slice(0, 10)
      const e = map.get(vin) ?? { vin, paid: null, bonded: null, date: '', pd: '', bd: '' }
      // 同一台车会出现几次（先进保税仓、后来交税）：日期晚的算数，日期一样的后面的行算数
      if (paid && date >= e.pd) {
        e.paid = paid
        e.pd = date
      }
      if (bonded && date >= e.bd) {
        e.bonded = bonded
        e.bd = date
      }
      if (date > e.date) e.date = date
      map.set(vin, e)
    }
    const entries = [...map.values()].filter((e) => e.paid || e.bonded).map((e) => ({ vin: e.vin, paid: e.paid, bonded: e.bonded, date: e.date }))
    out.push({ name, rows, noBoe: map.size - entries.length, entries })
  }
  return out
}

/** 对照系统里的车，算每台会怎么改（和数据库函数 import_boe 的规则一样） */
export function previewBoe(entries: BoeEntry[], vehicles: Stock[]): Preview[] {
  const byVin = new Map(vehicles.map((v) => [v.vin ?? '', v]))
  return entries.map((e) => {
    const v = byVin.get(e.vin)
    if (!v) return { ...e, outcome: 'missing', vehicle: null }
    const paidNow = v.customs_status === '已完税'
    const boeChange = !!e.paid && e.paid !== v.boe_no
    const bondedChange = !!e.bonded && e.bonded !== v.bonded_boe_no
    let outcome: Outcome
    if (e.paid) outcome = !paidNow ? 'paid' : boeChange || bondedChange ? 'paid_fill' : 'unchanged'
    else if (paidNow) outcome = bondedChange ? 'bonded_fill' : 'unchanged'
    else outcome = v.customs_status !== '未缴纳' || bondedChange ? 'bonded' : 'unchanged'
    return { ...e, outcome, vehicle: v }
  })
}

export const willChange = (p: Preview) => p.outcome !== 'missing' && p.outcome !== 'unchanged'
