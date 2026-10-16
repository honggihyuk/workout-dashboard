// 데이터 오류 범위표 (docs/04-system-design.md 5장)
// 막는 범위 밖이면 저장하지 않고, 지난번과 크게 다르면 "맞나요?"를 묻습니다.

export const limits = {
  weight: { min: 0, max: 400 },
  reps: { min: 1, max: 100 },
  runKm: { min: 0, max: 100 },
  /** 러닝 평균 페이스, 1km당 초 (2분~30분) */
  runPaceSec: { min: 120, max: 1800 },
  bodyWeight: { min: 30, max: 200 },
  bodyFatPct: { min: 2, max: 60 },
  mealKcal: { min: 0, max: 5000 },
  mealProtein: { min: 0, max: 300 },
  mealGram: { min: 0, max: 5000 },
  supplementServing: { min: 0, max: 500 },
  muscleKg: { min: 5, max: 100 },
  fatKg: { min: 0, max: 150 },
  bmr: { min: 500, max: 4000 },
}

/** 빈 칸이면 null, 숫자가 아니면 NaN */
export function num(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (t === '') return null
  return Number(t)
}

export function rangeError(label: string, v: number | null, r: { min: number; max: number }, opts: { exclusiveMin?: boolean; unit?: string } = {}): string | null {
  if (v == null) return null
  const unit = opts.unit ?? ''
  if (Number.isNaN(v)) return `${label}: 숫자로 적어 주세요`
  if (opts.exclusiveMin ? v <= r.min : v < r.min) return `${label}: ${r.min}${unit}${opts.exclusiveMin ? '보다 커야' : ' 이상이어야'} 해요`
  if (v > r.max) return `${label}: ${r.max}${unit} 이하여야 해요`
  return null
}

/** 지난번보다 ratio(0.3 = 30%) 넘게 다르면 true */
export function bigChangeRatio(prev: number | null | undefined, next: number, ratio: number): boolean {
  if (prev == null || prev <= 0) return false
  return Math.abs(next - prev) / prev > ratio
}

export function bigChangeAbs(prev: number | null | undefined, next: number, diff: number): boolean {
  if (prev == null) return false
  return Math.abs(next - prev) > diff
}
