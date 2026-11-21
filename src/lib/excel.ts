// 导出 Excel：每张表一组行（对象的键就是表头）。xlsx 包比较大，用到时才加载。
export type Sheet = { name: string; rows: Record<string, unknown>[]; widths?: number[] }

export async function exportXlsx(fileName: string, sheets: Sheet[]): Promise<void> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows)
    const keys = Object.keys(s.rows[0] ?? {})
    // 列宽：给了就用，没给按表头和内容的长度估（中文按两个字符算）
    ws['!cols'] = keys.map((k, i) => {
      if (s.widths?.[i]) return { wch: s.widths[i] }
      const len = (v: unknown) => [...String(v ?? '')].reduce((n, c) => n + (/[⺀-￿]/.test(c) ? 2 : 1), 0)
      const longest = Math.max(len(k), ...s.rows.slice(0, 200).map((r) => len(r[k])))
      return { wch: Math.min(Math.max(longest + 2, 6), 40) }
    })
    // 表名最多 31 个字符，不能有 : \ / ? * [ ]
    XLSX.utils.book_append_sheet(wb, ws, s.name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31))
  }
  XLSX.writeFile(wb, fileName)
}

// 文件名：几段用下划线连起来（空的跳过），去掉文件名里不能用的字符
export const xlsxName = (...parts: (string | null | undefined)[]) =>
  parts
    .map((p) => (p ?? '').trim().replace(/[\\/:*?"<>|]+/g, '-'))
    .filter(Boolean)
    .join('_') + '.xlsx'
