// 실제 서버(Supabase) 연결: 구글 로그인 → 허용 계정 확인 → 처음 목록 넣기 → 기록 불러오기
import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Loaded, Loading } from './Boot'
import { createSupabaseRepo, seedCloud } from './lib/data/supabaseRepo'
import { currentSession, isAllowed, onAuthChange, signInWithGoogle, signOut } from './lib/auth'
import { seedExercises, seedRoutineItems, seedRoutines, seedSupplements, SEED_VERSION } from './lib/seed'
import { local } from './lib/storage'

export default function CloudGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [repo] = useState(() => createSupabaseRepo())

  useEffect(() => {
    void currentSession().then(setSession)
    return onAuthChange((s) => setSession(s))
  }, [])

  const userId = session?.user.id
  useEffect(() => {
    if (!userId) return
    let alive = true
    setAllowed(null)
    isAllowed()
      .then(async (ok) => {
        if (ok && local.get('wcc.seed.' + userId) !== String(SEED_VERSION)) {
          await seedCloud({ exercises: seedExercises, supplements: seedSupplements, routines: seedRoutines, routine_items: seedRoutineItems })
          local.set('wcc.seed.' + userId, String(SEED_VERSION))
        }
        if (alive) setAllowed(ok)
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      alive = false
    }
  }, [userId])

  if (session === undefined) return <Loading />
  if (!session)
    return (
      <div className="login">
        <h1>운동 대시보드</h1>
        <p className="muted">대표님 구글 계정으로 로그인해 주세요. 한 번 로그인하면 이 기기에서 계속 유지돼요.</p>
        {error && <p className="error">{error}</p>}
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => signInWithGoogle().catch((e) => setError(e instanceof Error ? e.message : String(e)))}
        >
          구글로 로그인
        </button>
      </div>
    )
  if (error)
    return (
      <div className="login">
        <h1>연결에 문제가 있어요</h1>
        <p className="muted">{error}</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          다시 시도
        </button>
      </div>
    )
  if (allowed === null) return <Loading text="계정 확인 중…" />
  if (!allowed)
    return (
      <div className="login">
        <h1>사용할 수 없는 계정이에요</h1>
        <p className="muted">이 대시보드는 대표님 계정만 쓸 수 있어요. ({session.user.email})</p>
        <button type="button" className="btn btn-ghost" onClick={() => void signOut()}>
          다른 계정으로 로그인
        </button>
      </div>
    )
  return <Loaded repo={repo}>{children}</Loaded>
}
