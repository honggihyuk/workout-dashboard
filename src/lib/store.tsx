// 화면 전체가 함께 쓰는 기록 상태.
// - 저장은 화면에 먼저 반영하고(바로 보이게) 서버에 보냅니다.
// - 보내기에 실패하면 기기에 모아 두었다가 연결되면 순서대로 다시 보냅니다 (4차 5장 인증 만료·실행 실패).
// - 모든 저장은 id 기준 덮어쓰기라 두 번 보내도 한 건만 남습니다.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { addDays, today as kstToday } from './dates'
import { buildIndex, type Index } from './domain'
import type { Repo } from './data/repo'
import { allTables, type DB, type TableName, type Tables } from './types'
import { local } from './storage'

export type Op =
  | { kind: 'upsert'; table: TableName; rows: { id: string }[] }
  | { kind: 'remove'; table: TableName; ids: string[] }

export function upsert<K extends TableName>(table: K, rows: Tables[K][]): Op {
  return { kind: 'upsert', table, rows }
}

export function remove(table: TableName, ids: string[]): Op {
  return { kind: 'remove', table, ids }
}

interface StoreValue {
  repo: Repo
  db: DB
  index: Index
  todayDate: string
  pending: number
  syncError: string | null
  /** 여러 저장을 한 번에 (화면에는 바로 반영) */
  apply(ops: Op[]): void
  /** 더 지난 기록 불러오기 */
  ensureFrom(date: string): Promise<void>
  retry(): void
}

const StoreContext = createContext<StoreValue | null>(null)

const PENDING_KEY = 'wcc.pending.v1'
const LOAD_DAYS = 400

function applyOps(db: DB, ops: Op[]): DB {
  const next = { ...db } as Record<TableName, Map<string, unknown>>
  const touched = new Set<TableName>()
  for (const op of ops) {
    if (!touched.has(op.table)) {
      next[op.table] = new Map(next[op.table])
      touched.add(op.table)
    }
    const map = next[op.table]
    if (op.kind === 'upsert') for (const r of op.rows) map.set(r.id, r)
    else for (const id of op.ids) map.delete(id)
  }
  return next as DB
}

function mergeDB(db: DB, part: Partial<DB>): DB {
  const next = { ...db } as Record<TableName, Map<string, unknown>>
  for (const t of allTables) {
    const add = part[t] as Map<string, unknown> | undefined
    if (!add?.size) continue
    next[t] = new Map([...next[t], ...add])
  }
  return next as DB
}

export function StoreProvider({ repo, initial, children }: { repo: Repo; initial: DB; children: ReactNode }) {
  const [db, setDb] = useState<DB>(() => applyOps(initial, local.getJSON<Op[]>(PENDING_KEY) ?? []))
  const [todayDate, setToday] = useState(kstToday)
  const [pending, setPending] = useState(() => (local.getJSON<Op[]>(PENDING_KEY) ?? []).length)
  const [syncError, setSyncError] = useState<string | null>(null)
  const queue = useRef<Op[]>(local.getJSON<Op[]>(PENDING_KEY) ?? [])
  const flushing = useRef(false)
  const loadedFrom = useRef(addDays(kstToday(), -LOAD_DAYS))

  const persistQueue = () => {
    local.setJSON(PENDING_KEY, queue.current)
    setPending(queue.current.length)
  }

  const flush = useCallback(async () => {
    if (flushing.current) return
    flushing.current = true
    try {
      while (queue.current.length) {
        const op = queue.current[0]
        try {
          if (op.kind === 'upsert') await repo.upsert(op.table, op.rows as never)
          else await repo.remove(op.table, op.ids)
        } catch (e) {
          setSyncError(e instanceof Error ? e.message : String(e))
          return
        }
        queue.current.shift()
        persistQueue()
      }
      setSyncError(null)
    } finally {
      flushing.current = false
    }
  }, [repo])

  const apply = useCallback(
    (ops: Op[]) => {
      const real = ops.filter((o) => (o.kind === 'upsert' ? o.rows.length : o.ids.length))
      if (!real.length) return
      setDb((cur) => applyOps(cur, real))
      queue.current.push(...real)
      persistQueue()
      void flush()
    },
    [flush],
  )

  const ensureFrom = useCallback(
    async (date: string) => {
      if (date >= loadedFrom.current) return
      const to = addDays(loadedFrom.current, -1)
      loadedFrom.current = date
      const part = await repo.loadRange(date, to)
      setDb((cur) => mergeDB(cur, part))
    },
    [repo],
  )

  // 처음 열 때, 연결이 돌아올 때, 30초마다 남은 저장을 다시 보냄
  useEffect(() => {
    void flush()
    const onOnline = () => void flush()
    window.addEventListener('online', onOnline)
    const timer = window.setInterval(() => {
      if (queue.current.length) void flush()
    }, 30000)
    return () => {
      window.removeEventListener('online', onOnline)
      window.clearInterval(timer)
    }
  }, [flush])

  // 앱을 다시 열었을 때 날짜가 바뀌었으면 오늘을 새로 계산
  useEffect(() => {
    const check = () => setToday(kstToday())
    document.addEventListener('visibilitychange', check)
    const timer = window.setInterval(check, 60000)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.clearInterval(timer)
    }
  }, [])

  const index = useMemo(() => buildIndex(db), [db])
  const value = useMemo<StoreValue>(
    () => ({ repo, db, index, todayDate, pending, syncError, apply, ensureFrom, retry: () => void flush() }),
    [repo, db, index, todayDate, pending, syncError, apply, ensureFrom, flush],
  )
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext)
  if (!v) throw new Error('StoreProvider 밖에서 사용')
  return v
}

export const LOAD_FROM_DAYS = LOAD_DAYS
