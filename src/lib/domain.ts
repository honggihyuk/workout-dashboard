// 계산 규칙: 하루 루틴 상태(2차 3장), 주간 KPI(1차·2차), 운동 흐름(3차·5차)
// MVP에서는 화면에서 계산합니다 (docs/06-build.md 2장).
import { addDays, weekStart } from './dates'
import type {
  BodyWeight,
  Condition,
  DB,
  Exercise,
  InBody,
  Meal,
  MealSlot,
  Routine,
  Run,
  Supplement,
  SupplementLog,
  Workout,
  WorkoutSet,
} from './types'

export const MAIN_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner']
export const ALL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']
export const slotLabel: Record<MealSlot, string> = { breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식' }

export const WORKOUT_GOAL = 4 // 1차 기본값: 운동 주 4회
export const MEAL_GOAL_PER_DAY = 2 // 1차 기본값: 식사 사진 하루 2끼 이상

export interface DayRecords {
  date: string
  workout?: Workout
  sets: WorkoutSet[]
  runs: Run[]
  meals: Partial<Record<MealSlot, Meal>>
  logs: Map<string, SupplementLog>
  morning?: Condition
  post?: Condition
  weight?: BodyWeight
  inbody?: InBody
}

export interface Session {
  date: string
  sets: WorkoutSet[]
  volume: number
}

export interface Index {
  days: Map<string, DayRecords>
  /** 운동별 기록 (날짜 오름차순) */
  sessions: Map<string, Session[]>
  /** 운동한 날 (헬스 또는 러닝), 오름차순 */
  workoutDates: string[]
  exercises: Exercise[]
  supplements: Supplement[]
  /** 숨긴 것까지 모든 영양제·보충제 */
  supplementById: Map<string, Supplement>
  routines: Routine[]
  weights: BodyWeight[]
  inbody: InBody[]
  mornings: Condition[]
}

function emptyDay(date: string): DayRecords {
  return { date, sets: [], runs: [], meals: {}, logs: new Map() }
}

export function volumeOf(sets: { weight_kg: number; reps: number }[]): number {
  return sets.reduce((a, s) => a + s.weight_kg * s.reps, 0)
}

export function buildIndex(db: DB): Index {
  const days = new Map<string, DayRecords>()
  const day = (date: string) => {
    let d = days.get(date)
    if (!d) {
      d = emptyDay(date)
      days.set(date, d)
    }
    return d
  }
  for (const w of db.workouts.values()) day(w.date).workout = w
  for (const s of db.workout_sets.values()) day(s.date).sets.push(s)
  for (const r of db.runs.values()) day(r.date).runs.push(r)
  for (const m of db.meals.values()) day(m.date).meals[m.slot] = m
  for (const l of db.supplement_logs.values()) day(l.date).logs.set(l.supplement_id, l)
  for (const c of db.conditions.values()) {
    if (c.type === 'morning') day(c.date).morning = c
    else day(c.date).post = c
  }
  for (const w of db.body_weights.values()) day(w.date).weight = w
  for (const b of db.inbody.values()) day(b.date).inbody = b

  const sessions = new Map<string, Session[]>()
  const workoutDates: string[] = []
  for (const d of days.values()) {
    d.sets.sort((a, b) => a.exercise_pos - b.exercise_pos || a.set_no - b.set_no)
    if (d.sets.length || d.runs.length) workoutDates.push(d.date)
    const byEx = new Map<string, WorkoutSet[]>()
    for (const s of d.sets) {
      const list = byEx.get(s.exercise_id) ?? []
      list.push(s)
      byEx.set(s.exercise_id, list)
    }
    for (const [exId, sets] of byEx) {
      const list = sessions.get(exId) ?? []
      list.push({ date: d.date, sets, volume: volumeOf(sets) })
      sessions.set(exId, list)
    }
  }
  for (const list of sessions.values()) list.sort((a, b) => (a.date < b.date ? -1 : 1))
  workoutDates.sort()

  const byDate = <T extends { date: string }>(a: T, b: T) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
  return {
    days,
    sessions,
    workoutDates,
    exercises: [...db.exercises.values()],
    supplements: [...db.supplements.values()].filter((s) => !s.hidden).sort((a, b) => a.sort_order - b.sort_order),
    supplementById: db.supplements,
    routines: [...db.routines.values()].sort((a, b) => a.sort_order - b.sort_order),
    weights: [...db.body_weights.values()].sort(byDate),
    inbody: [...db.inbody.values()].sort(byDate),
    mornings: [...db.conditions.values()].filter((c) => c.type === 'morning').sort(byDate),
  }
}

export function dayOf(index: Index, date: string): DayRecords {
  return index.days.get(date) ?? emptyDay(date)
}

// ── 하루 루틴 상태 (2차 3-2) ─────────────────────────────

export type DayState = 'done' | 'in_progress' | 'missed' | 'empty' | 'future'

export interface DayItem {
  key: string
  label: string
  done: boolean
}

export interface DayStatus {
  date: string
  state: DayState
  isWorkoutDay: boolean
  isRunOnly: boolean
  items: DayItem[]
  missing: string[]
  hasAnyRecord: boolean
}

/** 식사 칸은 사진이 올라가거나 직접 적으면 채운 것으로 봅니다 (2차 가정 + 사진 없이 적은 경우) */
export function mealFilled(m: Meal | undefined): boolean {
  if (!m) return false
  return !!m.photo_path || m.status === 'confirmed' || m.manual_kcal != null || !!m.manual_menu
}

export function requiredWorkoutSupplements(supplements: Supplement[], isRunOnly: boolean): Supplement[] {
  return supplements.filter((s) => s.schedule === 'workout' && !(isRunOnly && s.optional_on_run_only))
}

export function dayStatus(index: Index, date: string, todayDate: string): DayStatus {
  const d = dayOf(index, date)
  const isGym = d.sets.length > 0
  const isWorkoutDay = isGym || d.runs.length > 0
  const isRunOnly = isWorkoutDay && !isGym
  const daily = index.supplements.filter((s) => s.schedule === 'daily')
  const items: DayItem[] = [
    { key: 'morning', label: '아침 컨디션', done: !!d.morning },
    ...MAIN_SLOTS.map((slot) => ({ key: 'meal_' + slot, label: `${slotLabel[slot]} 사진`, done: mealFilled(d.meals[slot]) })),
    { key: 'daily', label: '영양제', done: daily.every((s) => d.logs.has(s.id)) },
  ]
  if (isWorkoutDay) {
    const req = requiredWorkoutSupplements(index.supplements, isRunOnly)
    items.push(
      { key: 'workout', label: '운동 기록', done: true },
      { key: 'post', label: '운동 후 컨디션', done: !!d.post },
      { key: 'workout_supps', label: '보충제·쉐이크', done: req.every((s) => d.logs.has(s.id)) },
    )
  }
  const hasAnyRecord =
    isWorkoutDay ||
    !!d.workout ||
    Object.keys(d.meals).length > 0 ||
    d.logs.size > 0 ||
    !!d.morning ||
    !!d.post ||
    !!d.weight ||
    !!d.inbody
  const missing = items.filter((i) => !i.done).map((i) => i.label)
  let state: DayState
  if (date > todayDate) state = 'future'
  else if (missing.length === 0) state = 'done'
  else if (date === todayDate) state = 'in_progress'
  else state = hasAnyRecord ? 'missed' : 'empty'
  return { date, state, isWorkoutDay, isRunOnly, items, missing, hasAnyRecord }
}

// ── 주간 KPI ────────────────────────────────────────────

export type Verdict = 'good' | 'warn'

export interface InbodyVerdict {
  latest: InBody
  prev: InBody | null
  muscle: Verdict | null
  fat: Verdict | null
}

/** 골격근량: 유지·증가 좋음 / 감소 주의. 체지방률: 감소 좋음 / 유지·증가 주의 (2차 3-6) */
export function inbodyVerdict(index: Index, upTo: string): InbodyVerdict | null {
  const list = index.inbody.filter((b) => b.date <= upTo)
  if (!list.length) return null
  const latest = list[list.length - 1]
  const prev = list.length > 1 ? list[list.length - 2] : null
  if (!prev) return { latest, prev, muscle: null, fat: null }
  return {
    latest,
    prev,
    muscle: latest.skeletal_muscle_kg >= prev.skeletal_muscle_kg ? 'good' : 'warn',
    fat: latest.body_fat_pct < prev.body_fat_pct ? 'good' : 'warn',
  }
}

export interface WeeklyKpi {
  weekStart: string
  weekEnd: string
  workoutCount: number
  workoutGoal: number
  mealCount: number
  mealGoal: number
  inbody: InbodyVerdict | null
  hasAnyRecord: boolean
}

export function weeklyKpi(index: Index, date: string): WeeklyKpi {
  const start = weekStart(date)
  const end = addDays(start, 6)
  let workoutCount = 0
  let mealCount = 0
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const rec = index.days.get(d)
    if (!rec) continue
    if (rec.sets.length || rec.runs.length) workoutCount++
    for (const slot of MAIN_SLOTS) if (mealFilled(rec.meals[slot])) mealCount++
  }
  return {
    weekStart: start,
    weekEnd: end,
    workoutCount,
    workoutGoal: WORKOUT_GOAL,
    mealCount,
    mealGoal: MEAL_GOAL_PER_DAY * 7,
    inbody: inbodyVerdict(index, end),
    hasAnyRecord: index.days.size > 0,
  }
}

// ── 운동 ────────────────────────────────────────────────

/** date보다 앞선 마지막 기록 */
export function lastSession(index: Index, exerciseId: string, before: string): Session | null {
  const list = index.sessions.get(exerciseId)
  if (!list) return null
  for (let i = list.length - 1; i >= 0; i--) if (list[i].date < before) return list[i]
  return null
}

/** 최근 n회 (오름차순) */
export function recentSessions(index: Index, exerciseId: string, n = 5, upTo?: string): Session[] {
  const list = (index.sessions.get(exerciseId) ?? []).filter((s) => !upTo || s.date <= upTo)
  return list.slice(-n)
}

export function lastRun(index: Index, before: string): Run | null {
  for (let i = index.workoutDates.length - 1; i >= 0; i--) {
    const d = index.workoutDates[i]
    if (d >= before) continue
    const runs = index.days.get(d)?.runs
    if (runs?.length) return runs[0]
  }
  return null
}

export interface RoutineInfo {
  routine: Routine
  lastDate: string | null
}

export const isRunRoutine = (r: Routine | null | undefined) => r?.kind === 'run'

/** 다음 차례: 마지막으로 한 헬스 루틴의 다음 루틴 (적어 둔 순서대로 돌아감).
 *  러닝 루틴은 순서에 끼지 않습니다 (06-build.md 3-2). */
export function routineRotation(index: Index, db: DB): { list: RoutineInfo[]; next: Routine | null } {
  const list: RoutineInfo[] = index.routines.map((routine) => ({ routine, lastDate: null }))
  const cycle = list.filter((r) => !isRunRoutine(r.routine))
  let lastRoutineId: string | null = null
  let lastDate = ''
  for (const w of db.workouts.values()) {
    if (!w.routine_id) continue
    const info = list.find((r) => r.routine.id === w.routine_id)
    if (!info) continue
    if (!info.lastDate || w.date > info.lastDate) info.lastDate = w.date
    if (!isRunRoutine(info.routine) && w.date > lastDate) {
      lastDate = w.date
      lastRoutineId = w.routine_id
    }
  }
  if (!cycle.length) return { list, next: null }
  const i = cycle.findIndex((r) => r.routine.id === lastRoutineId)
  const next = cycle[(i + 1) % cycle.length].routine
  return { list, next }
}

// ── 러닝 ────────────────────────────────────────────────

/** 평균 페이스 (1km당 초). 시간이 없으면 null */
export function paceOf(run: Pick<Run, 'distance_km' | 'duration_sec'>): number | null {
  if (!run.duration_sec || !run.distance_km) return null
  return run.duration_sec / run.distance_km
}

/** 날짜 오름차순 러닝 기록 */
export function allRuns(index: Index, upTo?: string): Run[] {
  return index.workoutDates.filter((d) => !upTo || d <= upTo).flatMap((d) => index.days.get(d)?.runs ?? [])
}

export interface RunTotals {
  count: number
  km: number
  /** 시간을 적은 러닝만으로 낸 평균 페이스 (1km당 초) */
  pace: number | null
  durationSec: number
}

export function runTotals(runs: Run[]): RunTotals {
  let km = 0
  let timedKm = 0
  let durationSec = 0
  for (const r of runs) {
    km += r.distance_km
    if (r.duration_sec) {
      timedKm += r.distance_km
      durationSec += r.duration_sec
    }
  }
  return { count: runs.length, km, pace: timedKm ? durationSec / timedKm : null, durationSec }
}

/** 최고 기록: 가장 긴 거리, 가장 빠른 평균 페이스 (1km 이상 달린 날만) */
export function runBests(runs: Run[]): { longest: Run | null; fastest: Run | null } {
  let longest: Run | null = null
  let fastest: Run | null = null
  for (const r of runs) {
    if (!longest || r.distance_km > longest.distance_km) longest = r
    const p = paceOf(r)
    if (p != null && r.distance_km >= 1 && (!fastest || p < paceOf(fastest)!)) fastest = r
  }
  return { longest, fastest }
}

/** 목표 달성: 목표 거리 이상, 목표 페이스가 있으면 그보다 빠르거나 같게 */
export function runGoalMet(run: Pick<Run, 'distance_km' | 'duration_sec'>, routine: Routine | null | undefined): boolean | null {
  if (!routine || !isRunRoutine(routine) || (routine.target_km == null && routine.target_pace_sec == null)) return null
  if (routine.target_km != null && run.distance_km < routine.target_km) return false
  if (routine.target_pace_sec != null) {
    const p = paceOf(run)
    if (p == null || Math.round(p) > routine.target_pace_sec) return false
  }
  return true
}

export function routineExercises(db: DB, routineId: string) {
  return [...db.routine_items.values()]
    .filter((it) => it.routine_id === routineId)
    .sort((a, b) => a.position - b.position)
}

/** 최근 한 운동 (최근에 한 순서) */
export function recentExercises(index: Index, n = 5): { exerciseId: string; session: Session }[] {
  const out: { exerciseId: string; session: Session }[] = []
  for (const [exerciseId, list] of index.sessions) out.push({ exerciseId, session: list[list.length - 1] })
  out.sort((a, b) => (a.session.date > b.session.date ? -1 : 1))
  return out.slice(0, n)
}

export interface DaySummary {
  date: string
  routineName: string | null
  exerciseCount: number
  setCount: number
  volume: number
  runs: Run[]
}

export function daySummary(index: Index, db: DB, date: string): DaySummary | null {
  const d = index.days.get(date)
  if (!d || (!d.sets.length && !d.runs.length)) return null
  const routineId = d.workout?.routine_id
  return {
    date,
    routineName: routineId ? (db.routines.get(routineId)?.name ?? null) : null,
    exerciseCount: new Set(d.sets.map((s) => s.exercise_id)).size,
    setCount: d.sets.length,
    volume: volumeOf(d.sets),
    runs: d.runs,
  }
}

export function recentWorkoutDays(index: Index, db: DB, n = 3, before?: string): DaySummary[] {
  const dates = index.workoutDates.filter((d) => !before || d < before).slice(-n).reverse()
  return dates.map((d) => daySummary(index, db, d)!).filter(Boolean)
}

// ── 몸 변화 ─────────────────────────────────────────────

export function inRange<T extends { date: string }>(list: T[], from: string, to: string): T[] {
  return list.filter((x) => x.date >= from && x.date <= to)
}

export function lastBefore<T extends { date: string }>(list: T[], date: string): T | null {
  for (let i = list.length - 1; i >= 0; i--) if (list[i].date < date) return list[i]
  return null
}

// ── 표시 ────────────────────────────────────────────────

export function fmtNum(n: number, digits = 1): string {
  return Number(n.toFixed(digits)).toLocaleString('ko-KR')
}

export function fmtKg(n: number): string {
  return fmtNum(n, 2)
}

export function fmtDuration(sec: number | null): string {
  if (sec == null) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h ? (m ? `${h}시간 ${m}분` : `${h}시간`) : s ? `${m}분 ${s}초` : `${m}분`
}

/** 1km당 초 → 5'41" */
export function fmtPaceSec(sec: number | null, unit = true): string {
  if (sec == null) return ''
  const r = Math.round(sec)
  return `${Math.floor(r / 60)}'${String(r % 60).padStart(2, '0')}"${unit ? '/km' : ''}`
}

export function fmtPace(run: Pick<Run, 'distance_km' | 'duration_sec'>): string {
  return fmtPaceSec(paceOf(run))
}

/** 러닝 한 줄: 5.2km · 29분 34초 · 5'41"/km */
export function runText(run: Run): string {
  return [`${fmtNum(run.distance_km, 2)}km`, fmtDuration(run.duration_sec), fmtPace(run)].filter(Boolean).join(' · ')
}

/** 목표 한 줄: 목표 5km · 5'50"/km */
export function runTargetText(routine: Routine): string {
  const parts = [routine.target_km != null ? `${fmtNum(routine.target_km, 2)}km` : '', fmtPaceSec(routine.target_pace_sec)].filter(Boolean)
  return parts.length ? `목표 ${parts.join(' · ')}` : '거리와 평균 페이스로 기록'
}

export function setsText(sets: { weight_kg: number; reps: number }[]): string {
  return sets.map((s) => `${fmtKg(s.weight_kg)}×${s.reps}`).join(' · ')
}
