import { Button } from 'antd'
import type { ReactNode } from 'react'

/** 看起来像链接的按钮：点了在本页打开详情或跳到别的页面（没有真的地址，所以不用 <a>），键盘也能点 */
export default function LinkButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <Button type="link" size="small" className="link-btn" autoInsertSpace={false} onClick={onClick}>
      {children}
    </Button>
  )
}
