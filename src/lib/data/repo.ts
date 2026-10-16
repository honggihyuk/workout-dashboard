// 저장소 연결부. 체험판(기기 저장)과 실제 서버(Supabase)가 같은 모양으로 동작합니다.
import { allTables, type DB, type MealEstimate, type TableName, type Tables } from '../types'

export interface Repo {
  mode: 'demo' | 'cloud'
  /** 목록 표 전부 + 날짜 기록은 from 이후 */
  load(from: string): Promise<DB>
  /** 날짜 기록 중 from~to (더 지난 달을 볼 때) */
  loadRange(from: string, to: string): Promise<Partial<DB>>
  upsert<K extends TableName>(table: K, rows: Tables[K][]): Promise<void>
  remove(table: TableName, ids: string[]): Promise<void>
  putPhoto(path: string, blob: Blob): Promise<void>
  photoUrl(path: string): Promise<string | null>
  removePhoto(path: string): Promise<void>
  /** 올린 식사 사진을 AI로 분석. 실패하면 AnalyzeError */
  analyzePhoto(path: string): Promise<MealEstimate>
}

/**
 * 사진 분석 실패 이유
 * - rate_limit: 오늘 무료 한도를 다 씀 (새벽 재분석 대상)
 * - not_food: 음식 사진이 아님
 * - setup: 서버 설정 문제 (키·모델·서버 기능이 없음)
 * - offline: 인터넷 연결 없음
 * - failed: 그 밖의 실패 (시간 초과, 이상한 답 등)
 */
export type AnalyzeErrorCode = 'rate_limit' | 'not_food' | 'setup' | 'offline' | 'failed'

export class AnalyzeError extends Error {
  code: AnalyzeErrorCode
  constructor(code: AnalyzeErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code)
    this.code = code
  }
}

/** 서버 기능이 돌려준 오류 이름 → 화면에서 쓰는 실패 이유 */
export function analyzeErrorCode(serverCode: unknown, status?: number): AnalyzeErrorCode {
  if (serverCode === 'rate_limit' || status === 429) return 'rate_limit'
  if (serverCode === 'not_food') return 'not_food'
  if (serverCode === 'photo_not_found' || serverCode === 'unauthorized') return 'failed'
  if (serverCode === 'not_configured' || serverCode === 'bad_key' || serverCode === 'bad_model' || serverCode === 'forbidden' || status === 404) return 'setup'
  return 'failed'
}

export function emptyDB(): DB {
  const db = {} as Record<TableName, Map<string, unknown>>
  for (const t of allTables) db[t] = new Map()
  return db as DB
}

export function toDB(rows: Partial<{ [K in TableName]: Tables[K][] }>): DB {
  const db = emptyDB()
  for (const t of allTables) {
    const list = rows[t] as { id: string }[] | undefined
    if (list) for (const r of list) (db[t] as Map<string, unknown>).set(r.id, r)
  }
  return db
}

export function photoPath(date: string, mealId: string): string {
  return `${date}/${mealId}.jpg`
}
