// 구글 로그인 (docs/04-system-design.md 4-2). 대표님 계정 1개만 허용합니다.
// 허용 여부는 서버가 판단합니다 (is_allowed 함수, supabase/migrations/0001_init.sql).
import type { Session } from '@supabase/supabase-js'
import { getClient } from './data/supabaseRepo'

export async function currentSession(): Promise<Session | null> {
  const { data } = await getClient().auth.getSession()
  return data.session
}

export async function signInWithGoogle(): Promise<void> {
  const redirectTo = window.location.origin + window.location.pathname
  const { error } = await getClient().auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  await getClient().auth.signOut()
}

export async function isAllowed(): Promise<boolean> {
  const { data, error } = await getClient().rpc('is_allowed')
  if (error) throw error
  return data === true
}

export function onAuthChange(fn: (session: Session | null) => void): () => void {
  const { data } = getClient().auth.onAuthStateChange((_event, session) => fn(session))
  return () => data.subscription.unsubscribe()
}
