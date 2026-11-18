// 车架号（VIN）：去掉空格、转大写（和数据库的 norm_vin 一样）；17 位的顺便核对第 9 位校验位，帮着发现输错的字母或数字。
// 工程机械的出厂编号不一定是标准 VIN，所以校验位不对只提醒，不拦着。

export function normVin(v: string | null | undefined): string {
  return (v ?? '').replace(/\s/g, '').toUpperCase()
}

/** 搜索用：只留字母、数字和横杠 */
export function vinQuery(v: string | null | undefined): string {
  return normVin(v).replace(/[^A-Z0-9-]/g, '')
}

const VALUES: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
}
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]

/** 'ok' 校验位对；'bad' 17 位但校验位不对或有 I/O/Q；'skip' 不是 17 位，不核对 */
export function vinCheck(raw: string): 'ok' | 'bad' | 'skip' {
  const vin = normVin(raw)
  if (vin.length !== 17) return 'skip'
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return 'bad'
  let sum = 0
  for (let i = 0; i < 17; i++) {
    const c = vin[i]
    const n = /\d/.test(c) ? Number(c) : VALUES[c]
    sum += n * WEIGHTS[i]
  }
  const r = sum % 11
  return vin[8] === (r === 10 ? 'X' : String(r)) ? 'ok' : 'bad'
}
