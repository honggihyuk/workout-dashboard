// 단백질 목표와 하루 칼로리 비교 (6차 MVP v1 검수 요청)
// - 단백질 목표: 체중 × 1.5~2g (대표님 확정)
// - 쓴 칼로리: 기초대사량 + 일상 활동 + 운동. 운동은 쉬는 동안 쓰는 몫을 뺀 "활동 칼로리"로 계산해
//   기초대사량과 겹치지 않게 합니다 (계산식은 docs/06-build.md 3-2).
import { addDays } from './dates'
import { dayOf, fmtNum, lastBefore, type Index } from './domain'
import type { Meal, Run, Supplement } from './types'

export const PROTEIN_G_PER_KG = { min: 1.5, max: 2 }
/** 일상 활동: 기초대사량의 20% (앉아서 일하는 하루 기준) */
export const DAILY_ACTIVITY_RATIO = 0.2
/** 인바디가 없을 때 기초대사량 어림: 체중 1kg당 하루 24kcal */
export const BMR_KCAL_PER_KG = 24
/** 헬스 시간 어림: 한 세트에 쉬는 시간 포함 3분 */
export const MIN_PER_SET = 3
/** 러닝 활동 칼로리: 체중 1kg이 1km 달릴 때 약 1kcal */
export const RUN_KCAL_PER_KG_KM = 1

/** 헬스 운동 강도(MET). 운동 후 컨디션의 "운동 강도 느낌"으로 고름 */
export function gymMet(intensity: number | null | undefined): number {
  if (intensity == null) return 5
  if (intensity <= 2) return 3.5
  if (intensity === 3) return 5
  return 6
}

/** 식단에 더하는 영양제·보충제 (쉐이크 등): 단백질이나 칼로리가 적힌 것 */
export const addsToDiet = (s: Supplement) => s.protein_g != null || s.kcal != null

/** 40g · 단백질 36g · 150kcal */
export function supplementNutritionText(s: Supplement): string {
  return [
    s.serving_g != null ? `${fmtNum(s.serving_g)}g` : '',
    s.protein_g != null ? `단백질 ${fmtNum(s.protein_g)}g` : '',
    s.kcal != null ? `${fmtNum(s.kcal, 0)}kcal` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

export const mealKcal = (m: Meal) => m.manual_kcal ?? m.ai_kcal
export const mealProtein = (m: Meal) => m.manual_protein_g ?? m.ai_protein_g

/** 그날 또는 그 전 마지막 체중 */
export function weightOn(index: Index, date: string): number | null {
  return lastBefore(index.weights, addDays(date, 1))?.weight_kg ?? null
}

export function runKcal(run: Pick<Run, 'distance_km'>, kg: number): number {
  return RUN_KCAL_PER_KG_KM * kg * run.distance_km
}

export function gymKcal(sets: number, intensity: number | null | undefined, kg: number): number {
  const hours = (sets * MIN_PER_SET) / 60
  return (gymMet(intensity) - 1) * kg * hours
}

export interface DayNutrition {
  weightKg: number | null
  intake: {
    kcal: number
    protein: number
    /** 숫자가 있는 끼니 수 */
    counted: number
    /** 사진·메뉴만 있고 숫자가 없는 끼니 수 */
    missing: number
    /** 숫자가 AI 추정이고 아직 확인하지 않은 끼니 수 */
    estimated: number
    /** 먹은 쉐이크 등 (식단에 더하는 영양제·보충제) */
    extras: Supplement[]
  }
  protein: { min: number; max: number } | null
  /** 운동 활동 칼로리. 체중이 없으면 null */
  exercise: { gym: number; run: number; total: number; sets: number; runKm: number } | null
  /** 하루 쓴 칼로리. 체중도 인바디도 없으면 null */
  burn: { bmr: number; bmrFromInbody: boolean; daily: number; exercise: number; total: number } | null
}

export function dayNutrition(index: Index, date: string): DayNutrition {
  const d = dayOf(index, date)
  const kg = weightOn(index, date)

  let kcal = 0
  let protein = 0
  let counted = 0
  let missing = 0
  let estimated = 0
  for (const m of Object.values(d.meals)) {
    if (!m) continue
    const k = mealKcal(m)
    const p = mealProtein(m)
    if (k == null && p == null) {
      if (m.photo_path || m.manual_menu) missing++
      continue
    }
    counted++
    if (m.status === 'estimated') estimated++
    kcal += k ?? 0
    protein += p ?? 0
  }

  const extras: Supplement[] = []
  for (const sid of d.logs.keys()) {
    const s = index.supplementById.get(sid)
    if (!s || !addsToDiet(s)) continue
    extras.push(s)
    kcal += s.kcal ?? 0
    protein += s.protein_g ?? 0
  }

  const runKm = d.runs.reduce((a, r) => a + r.distance_km, 0)
  const exercise =
    kg == null
      ? null
      : (() => {
          const gym = d.sets.length ? gymKcal(d.sets.length, d.post?.intensity, kg) : 0
          const run = runKcal({ distance_km: runKm }, kg)
          return { gym, run, total: gym + run, sets: d.sets.length, runKm }
        })()

  const inbody = lastBefore(index.inbody, addDays(date, 1))
  const bmr = inbody?.bmr_kcal ?? (kg != null ? kg * BMR_KCAL_PER_KG : null)
  const burn =
    bmr == null
      ? null
      : {
          bmr,
          bmrFromInbody: inbody?.bmr_kcal != null,
          daily: bmr * DAILY_ACTIVITY_RATIO,
          exercise: exercise?.total ?? 0,
          total: bmr * (1 + DAILY_ACTIVITY_RATIO) + (exercise?.total ?? 0),
        }

  return {
    weightKg: kg,
    intake: { kcal, protein, counted, missing, estimated, extras },
    protein: kg == null ? null : { min: kg * PROTEIN_G_PER_KG.min, max: kg * PROTEIN_G_PER_KG.max },
    exercise,
    burn,
  }
}

/** 단백질: 목표 범위와 먹은 양의 차이 */
export function proteinGap(eaten: number, target: { min: number; max: number }): { state: 'under' | 'in' | 'over'; grams: number } {
  if (eaten < target.min) return { state: 'under', grams: target.min - eaten }
  if (eaten > target.max) return { state: 'over', grams: eaten - target.max }
  return { state: 'in', grams: 0 }
}
