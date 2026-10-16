// 앱 시작: 저장소 고르기 → (실제 서버면) 로그인 확인 → 기록 불러오기
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { addDays, today } from './lib/dates'
import type { DB } from './lib/types'
import type { Repo } from './lib/data/repo'
import { createLocalRepo } from './lib/data/localRepo'
import { isDemo } from './lib/config'
import { LOAD_FROM_DAYS, StoreProvider } from './lib/store'

export function Loading({ text = '불러오는 중…' }: { text?: string }) {
  return <div className="loading">{text}</div>
}

export function Loaded({ repo, children }: { repo: Repo; children: ReactNode }) {
  const [db, setDb] = useState<DB | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    repo
      .load(addDays(today(), -LOAD_FROM_DAYS))
      .then((d) => alive && setDb(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      alive = false
    }
  }, [repo])
  if (error)
    return (
      <div className="login">
        <h1>기록을 불러오지 못했어요</h1>
        <p className="muted">인터넷 연결을 확인한 뒤 다시 열어 주세요. ({error})</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          다시 시도
        </button>
      </div>
    )
  if (!db) return <Loading />
  return (
    <StoreProvider repo={repo} initial={db}>
      {children}
    </StoreProvider>
  )
}

const demoRepo = isDemo ? createLocalRepo() : null
// 실제 서버 연결 코드는 필요할 때만 불러옵니다 (체험판을 가볍게)
const CloudGate = lazy(() => import('./CloudGate'))

export default function Boot({ children }: { children: ReactNode }) {
  if (demoRepo) return <Loaded repo={demoRepo}>{children}</Loaded>
  return (
    <Suspense fallback={<Loading />}>
      <CloudGate>{children}</CloudGate>
    </Suspense>
  )
}
