// 把数据库 / 接口错误翻成看得懂的话（跟着界面语言）。数据库函数和账号服务发回来的中文报错按对照表翻成英文。
import { tr, trServer } from './i18n'

type ErrLike = { message?: string; code?: string; details?: string | null; hint?: string | null } | null | undefined

export function errorText(e: unknown): string {
  const err = (e ?? {}) as NonNullable<ErrLike>
  const msg = err.message ?? String(e)
  const code = err.code ?? ''
  if (code === '42501' || /row-level security|permission denied/i.test(msg)) {
    // 数据库函数自己写的权限报错（请先登录、没有开通录入权限、只有管理员可以……）原样翻译
    if (/[一-鿿]/.test(msg)) return trServer(msg)
    return tr('没有权限做这个操作')
  }
  if (code === '23505' || /duplicate key/i.test(msg)) {
    if (/vin/i.test(msg)) return tr('这个车架号已经存在')
    if (/locations/i.test(msg)) return tr('这个位置已经存在')
    return tr('数据重复，已经存在相同的记录')
  }
  if (code === '23503' || /foreign key/i.test(msg)) return tr('还有其他记录在用它，不能删除或修改')
  if (code === '23514' || /check constraint/i.test(msg)) return tr('填写的内容不符合要求：') + trServer(msg)
  if (/Invalid login credentials/i.test(msg)) return tr('邮箱或密码不对')
  if (/Email not confirmed/i.test(msg)) return tr('邮箱还没有确认，请找管理员处理')
  if (/User already registered/i.test(msg)) return tr('这个邮箱已经注册过了，请直接登录')
  if (/Password should be at least/i.test(msg)) return tr('密码至少 6 位')
  if (code === 'same_password' || /^New password should be different/i.test(msg)) return tr('新密码不能和当前密码一样')
  if (code === 'weak_password' || /^Password .*(weak|easy to guess)/i.test(msg)) return tr('这个密码太简单，请换一个')
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return tr('网络连接失败，请检查网络后重试')
  return trServer(msg)
}
