// 체험판 예시 기록: 오늘 기준 지난 6주. 검수할 때 화면이 비어 보이지 않게 넣습니다.
import { addDays, weekday } from '../dates'
import { ids, newId } from '../ids'
import { RUN_ROUTINE_ID, seedExercises, seedRoutineItems, seedRoutines, seedSupplements, SEED_VERSION } from '../seed'
import type { Condition, Meal, MealEstimate, MealSlot, Run, SupplementLog, Tables, Workout, WorkoutSet } from '../types'

export const DEMO_PHOTO_PREFIX = 'demo/'

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 운동별 시작 무게 (kg)
const baseWeight: Record<string, number> = {
  bench_press: 70,
  incline_db_press: 24,
  cable_crossover: 12.5,
  triceps_pushdown: 22.5,
  lat_pulldown: 52.5,
  barbell_row: 55,
  seated_cable_row: 45,
  barbell_curl: 27.5,
  squat: 85,
  leg_press: 150,
  overhead_press: 40,
  lateral_raise: 9,
}

const menus: [string, number, number][] = [
  ['현미밥, 닭가슴살, 김치', 520, 38],
  ['제육볶음 정식', 780, 35],
  ['연어 포케', 640, 32],
  ['그릭요거트, 바나나', 310, 18],
  ['소고기 덮밥', 720, 36],
  ['닭가슴살 샐러드', 420, 35],
  ['김치찌개, 밥', 650, 24],
  ['계란 3개, 토스트', 450, 24],
]

export function demoData(todayDate: string): { [K in keyof Tables]: Tables[K][] } {
  const r = rng(20261015)
  const start = addDays(todayDate, -42)
  const workouts: Workout[] = []
  const sets: WorkoutSet[] = []
  const runs: Run[] = []
  const meals: Meal[] = []
  const logs: SupplementLog[] = []
  const conditions: Condition[] = []
  const weights: Tables['body_weights'][] = []
  const sessionCount: Record<string, number> = {}
  let rotation = 0
  const gymRoutines = seedRoutines.filter((x) => x.kind === 'weight')
  // 체험판에서는 러닝 루틴에 목표 페이스도 넣어 둠 (5'50"/km)
  const routines = seedRoutines.map((x) => (x.id === RUN_ROUTINE_ID ? { ...x, target_pace_sec: 350 } : x))
  let fatigue = 2
  let sleep = 4

  const meal = (date: string, slot: MealSlot, time: string, confirmed: boolean, photo = true): Meal => {
    const [menu, kcal, protein] = menus[Math.floor(r() * menus.length)]
    return {
      id: ids.meal(date, slot),
      date,
      slot,
      eaten_at: time,
      photo_path: photo ? `${DEMO_PHOTO_PREFIX}${Math.floor(r() * 6)}` : null,
      // 확인 안 한 사진은 AI 추정이 들어 있는 상태 (6차 2단계)
      status: confirmed ? 'confirmed' : photo ? 'estimated' : 'empty',
      ai_menu: !confirmed && photo ? menu : null,
      ai_kcal: !confirmed && photo ? kcal : null,
      ai_protein_g: !confirmed && photo ? protein : null,
      manual_menu: confirmed ? menu : null,
      manual_g: null,
      manual_kcal: confirmed ? kcal : null,
      manual_protein_g: confirmed ? protein : null,
      memo: null,
    }
  }
  const log = (date: string, supplementId: string, time: string): SupplementLog => ({
    id: ids.supplementLog(date, supplementId),
    date,
    supplement_id: supplementId,
    taken_at: `${date}T${time}:00+09:00`,
  })

  for (let date = start; date < todayDate; date = addDays(date, 1)) {
    const wd = weekday(date)
    const forgetful = r() < 0.08
    // 아침 컨디션
    fatigue = Math.min(5, Math.max(1, fatigue + (r() < 0.3 ? -1 : r() < 0.6 ? 1 : 0)))
    sleep = Math.min(5, Math.max(1, sleep + (r() < 0.3 ? -1 : r() < 0.6 ? 1 : 0)))
    if (!forgetful || r() < 0.5) conditions.push({ id: ids.morning(date), date, type: 'morning', fatigue, sleep_quality: sleep, intensity: null, focus: null })
    // 식사
    meals.push(meal(date, 'breakfast', '08:' + String(Math.floor(r() * 50) + 10), r() < 0.8))
    meals.push(meal(date, 'lunch', '12:' + String(Math.floor(r() * 50) + 10), r() < 0.7))
    if (!forgetful) meals.push(meal(date, 'dinner', '19:' + String(Math.floor(r() * 50) + 10), r() < 0.6))
    if (r() < 0.2) meals.push(meal(date, 'snack', '16:00', true))
    // 영양제 (매일)
    for (const s of seedSupplements.filter((x) => x.schedule === 'daily')) if (!forgetful || r() < 0.6) logs.push(log(date, s.id, '08:30'))

    // 운동: 월·화·목·금 헬스 (루틴 차례대로), 토 러닝
    const gym = wd === 0 || wd === 1 || wd === 3 || wd === 4
    const run = wd === 5 && r() < 0.85
    if (gym && r() < 0.9) {
      const routine = gymRoutines[rotation % gymRoutines.length]
      rotation++
      workouts.push({ id: ids.workout(date), date, routine_id: routine.id, memo: null })
      seedRoutineItems
        .filter((it) => it.routine_id === routine.id)
        .forEach((it) => {
          const n = (sessionCount[it.exercise_id] = (sessionCount[it.exercise_id] ?? 0) + 1)
          const base = baseWeight[it.exercise_id] ?? 20
          const step = base >= 50 ? 2.5 : base >= 20 ? 1 : 0.5
          const top = base + Math.floor(n / 2) * step
          for (let k = 1; k <= it.default_sets; k++) {
            const warm = k === 1
            sets.push({
              id: newId(),
              date,
              exercise_id: it.exercise_id,
              exercise_pos: it.position,
              set_no: k,
              weight_kg: warm ? Math.round((top * 0.8) / step) * step : top,
              reps: warm ? 12 : 10 - k + (r() < 0.3 ? 1 : 0),
            })
          }
        })
    }
    if (run) {
      workouts.push({ id: ids.workout(date), date, routine_id: RUN_ROUTINE_ID, memo: null })
      const km = Math.round((5 + r() * 3) * 10) / 10
      runs.push({ id: newId(), date, distance_km: km, duration_sec: Math.round(km * (330 + r() * 40)), memo: null })
    }
    if ((gym || run) && (sets.some((s) => s.date === date) || run)) {
      if (r() < 0.93) conditions.push({ id: ids.postWorkout(date), date, type: 'post_workout', fatigue: null, sleep_quality: null, intensity: 3 + Math.floor(r() * 3), focus: 2 + Math.floor(r() * 4) })
      for (const s of seedSupplements.filter((x) => x.schedule === 'workout')) {
        if (s.optional_on_run_only && !sets.some((x) => x.date === date) && r() < 0.6) continue
        if (r() < 0.97) logs.push(log(date, s.id, '20:40'))
      }
    }
    // 체중: 이틀에 한 번
    if (wd % 2 === 0) weights.push({ id: ids.bodyWeight(date), date, weight_kg: Math.round((76.9 - 0.03 * weights.length + (r() - 0.5) * 0.6) * 10) / 10 })
  }

  // 오늘: 아침 컨디션 완료, 아침 식사 확인함, 점심 AI 추정(확인 전), 영양제 3/5
  conditions.push({ id: ids.morning(todayDate), date: todayDate, type: 'morning', fatigue: 2, sleep_quality: 4, intensity: null, focus: null })
  meals.push({ ...meal(todayDate, 'breakfast', '08:10', true), manual_menu: '현미밥, 닭가슴살, 김치', manual_kcal: 520, manual_protein_g: 38 })
  meals.push(meal(todayDate, 'lunch', '12:40', false))
  for (const id of ['vitamin_c', 'lutein', 'omega3']) logs.push(log(todayDate, id, '08:30'))

  const inbody: Tables['inbody'][] = [
    { id: ids.inbody(addDays(todayDate, -40)), date: addDays(todayDate, -40), skeletal_muscle_kg: 33.9, body_fat_pct: 16.4, body_fat_kg: 12.5, bmr_kcal: 1704 },
    { id: ids.inbody(addDays(todayDate, -9)), date: addDays(todayDate, -9), skeletal_muscle_kg: 34.2, body_fat_pct: 15.8, body_fat_kg: 12.1, bmr_kcal: 1712 },
  ]

  return {
    exercises: seedExercises,
    routines,
    routine_items: seedRoutineItems,
    supplements: seedSupplements,
    workouts,
    workout_sets: sets,
    runs,
    meals,
    supplement_logs: logs,
    conditions,
    body_weights: weights,
    inbody,
  }
}

export { SEED_VERSION }

/** 체험판 사진 분석: 실제 AI 대신 사진 경로로 정해지는 예시 결과 */
export function demoEstimate(path: string): MealEstimate {
  let h = 0
  for (const c of path) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0
  const [menu, kcal, protein] = menus[Math.abs(h) % menus.length]
  const confidence = (['high', 'medium', 'medium', 'low'] as const)[Math.abs(h >> 3) % 4]
  return { menu, kcal, protein_g: protein, confidence }
}

/** 체험판 음식 사진 대신 쓰는 그림 */
export function demoPhoto(path: string): string {
  const n = Number(path.slice(DEMO_PHOTO_PREFIX.length)) || 0
  const palettes = [
    ['#F3E3C3', '#C9772E', '#6E9B48'],
    ['#EFD9D2', '#B5482F', '#E8B04B'],
    ['#DDE8E0', '#E07A5F', '#3D7A5A'],
    ['#F1EBDD', '#8C5A3C', '#D9C08A'],
    ['#E3E7EF', '#D96C3E', '#F2C14E'],
    ['#EDE3D4', '#A33B2B', '#7FA650'],
  ][n % 6]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="${palettes[0]}"/><circle cx="160" cy="124" r="92" fill="#fff"/><circle cx="160" cy="124" r="70" fill="#f6f2ea"/><circle cx="135" cy="112" r="30" fill="${palettes[1]}"/><circle cx="182" cy="140" r="26" fill="${palettes[2]}"/><circle cx="178" cy="98" r="16" fill="${palettes[1]}" opacity=".7"/></svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}
