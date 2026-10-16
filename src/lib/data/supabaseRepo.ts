// 실제 서버 저장소 (Supabase). 표 구조: supabase/migrations/0001_init.sql
import { createClient, FunctionsFetchError, FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js'
import { datedTables, listTables, type DB, type MealEstimate, type TableName } from '../types'
import { AnalyzeError, analyzeErrorCode, toDB, type Repo } from './repo'

const BUCKET = 'meal-photos'
const PAGE = 1000
/** 사진 분석 기다리는 시간 (서버 쪽 Gemini 제한 30초 + 사진 받기 여유) */
const ANALYZE_TIMEOUT_MS = 45_000

let client: SupabaseClient | null = null

export function getClient(): SupabaseClient {
  if (!client) {
    client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    })
  }
  return client
}

async function selectAll(table: TableName, filter?: (q: any) => any): Promise<unknown[]> {
  const sb = getClient()
  const out: unknown[] = []
  for (let from = 0; ; from += PAGE) {
    let q = sb.from(table).select('*')
    if (filter) q = filter(q)
    const { data, error } = await q.order('id').range(from, from + PAGE - 1)
    if (error) throw error
    out.push(...data)
    if (data.length < PAGE) return out
  }
}

// 기록 표의 owner 칸은 서버가 채우므로 화면 쪽 모양에는 없습니다
function strip(rows: unknown[]): unknown[] {
  return rows.map((r) => {
    const { owner: _o, created_at: _c, updated_at: _u, ...rest } = r as Record<string, unknown>
    return rest
  })
}

const signedUrls = new Map<string, { url: string; until: number }>()

export function createSupabaseRepo(): Repo {
  const sb = getClient()
  return {
    mode: 'cloud',
    async load(from) {
      const rows: Record<string, unknown[]> = {}
      await Promise.all([
        ...listTables.map(async (t) => (rows[t] = strip(await selectAll(t)))),
        ...datedTables.map(async (t) => (rows[t] = strip(await selectAll(t, (q) => q.gte('date', from))))),
      ])
      return toDB(rows)
    },
    async loadRange(from, to) {
      const rows: Record<string, unknown[]> = {}
      await Promise.all(datedTables.map(async (t) => (rows[t] = strip(await selectAll(t, (q) => q.gte('date', from).lte('date', to))))))
      return toDB(rows) as Partial<DB>
    },
    async upsert(table, list) {
      if (!list.length) return
      const { error } = await sb.from(table).upsert(list as object[], { onConflict: 'id' })
      if (error) throw error
    },
    async remove(table, ids) {
      if (!ids.length) return
      const { error } = await sb.from(table).delete().in('id', ids)
      if (error) throw error
    },
    async putPhoto(path, blob) {
      const { error } = await sb.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (error) throw error
      signedUrls.delete(path)
    },
    async photoUrl(path) {
      const hit = signedUrls.get(path)
      if (hit && hit.until > Date.now()) return hit.url
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600)
      if (error || !data) return null
      signedUrls.set(path, { url: data.signedUrl, until: Date.now() + 50 * 60 * 1000 })
      return data.signedUrl
    },
    async removePhoto(path) {
      await sb.storage.from(BUCKET).remove([path])
      signedUrls.delete(path)
    },
    async analyzePhoto(path) {
      if (!navigator.onLine) throw new AnalyzeError('offline')
      const { data, error } = await sb.functions.invoke<MealEstimate>('meal-analyze', { body: { photo_path: path }, timeout: ANALYZE_TIMEOUT_MS })
      if (error) {
        if (error instanceof FunctionsHttpError) {
          const res = error.context as Response
          const body = (await res.json().catch(() => null)) as { error?: unknown } | null
          throw new AnalyzeError(analyzeErrorCode(body?.error, res.status), `${res.status} ${String(body?.error ?? '')}`)
        }
        if (error instanceof FunctionsFetchError) throw new AnalyzeError(navigator.onLine ? 'failed' : 'offline', error.message)
        throw new AnalyzeError('failed', error.message)
      }
      if (!data || typeof data.menu !== 'string' || typeof data.kcal !== 'number' || typeof data.protein_g !== 'number') throw new AnalyzeError('failed', 'bad_answer')
      return { menu: data.menu, kcal: data.kcal, protein_g: data.protein_g, confidence: data.confidence }
    },
  }
}

/** 처음 들어 있는 목록 넣기. 이미 있는 것은 건드리지 않습니다 (숨김 등 바꾼 값 유지) */
export async function seedCloud(seed: {
  exercises: object[]
  supplements: object[]
  routines: object[]
  routine_items: object[]
}): Promise<void> {
  const sb = getClient()
  const { count } = await sb.from('routines').select('id', { count: 'exact', head: true })
  const { count: exCount } = await sb.from('exercises').select('id', { count: 'exact', head: true })
  const fresh = !count && !exCount
  for (const t of ['exercises', 'supplements'] as const) {
    const { error } = await sb.from(t).upsert(seed[t], { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw error
  }
  if (fresh) {
    for (const t of ['routines', 'routine_items'] as const) {
      const { error } = await sb.from(t).upsert(seed[t], { onConflict: 'id', ignoreDuplicates: true })
      if (error) throw error
    }
  }
}
