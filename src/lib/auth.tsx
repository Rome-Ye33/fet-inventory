import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from './supabase'
import type { AppUser, Role } from './supabase'

type AuthState = {
  loading: boolean
  session: Session | null
  me: AppUser | null
  /** 已开通的角色；没开通或已停用是 null */
  role: Role | null
  isAdmin: boolean
  /** 能录入：管理员、录入员 */
  canWrite: boolean
  reload: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [me, setMe] = useState<AppUser | null>(null)
  // 资料是哪个账号的：登录后 session 先有、资料还在读，这时按“还在加载”算，免得闪一下“账号还没有开通”
  const [meUid, setMeUid] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadMe = useCallback(async (s: Session | null) => {
    if (!s) {
      setMe(null)
      setMeUid(null)
      return
    }
    const { data } = await supabase.from('app_users').select('*').eq('user_id', s.user.id).maybeSingle()
    setMe(data ?? null)
    setMeUid(s.user.id)
  }, [])

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setSession(data.session)
      await loadMe(data.session)
      if (alive) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // 不能在回调里直接 await supabase 调用，放到下一轮
        setTimeout(() => {
          void loadMe(s).then(() => setLoading(false))
        }, 0)
      }
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [loadMe])

  const value = useMemo<AuthState>(() => {
    const role = me && me.active ? (me.role as Role) : null
    const ready = !session || meUid === session.user.id
    return {
      loading: loading || !ready,
      session,
      me,
      role,
      isAdmin: role === 'admin',
      canWrite: role === 'admin' || role === 'staff',
      reload: () => loadMe(session),
      signOut: async () => {
        await supabase.auth.signOut()
        setMe(null)
      },
    }
  }, [loading, session, me, meUid, loadMe])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: '管理员',
  staff: '录入员',
  viewer: '只读',
}

export const ROLE_COLOR: Record<Role, string> = {
  admin: 'red',
  staff: 'blue',
  viewer: 'green',
}
