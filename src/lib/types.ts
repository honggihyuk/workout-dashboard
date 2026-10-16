// 데이터 표 정의: docs/04-system-design.md 2-1, supabase/migrations/0001_init.sql 과 같은 모양
// 날짜는 한국 시간 기준 'YYYY-MM-DD' 문자열입니다.

export type BodyPart = '가슴' | '등' | '하체' | '어깨' | '팔' | '복근' | '유산소'
export type Equipment = '바벨' | '덤벨' | '머신' | '케이블' | '맨몸'

export interface Exercise {
  id: string
  name: string
  body_part: BodyPart
  equipment: Equipment
  kind: 'weight' | 'run'
  is_custom: boolean
  hidden: boolean
}

export type RoutineKind = 'weight' | 'run'

export interface Routine {
  id: string
  name: string
  sort_order: number
  /** 헬스 루틴(운동 목록) 또는 러닝 루틴(목표 거리·페이스) */
  kind: RoutineKind
  target_km: number | null
  /** 목표 평균 페이스 (1km당 초) */
  target_pace_sec: number | null
}

export interface RoutineItem {
  id: string
  routine_id: string
  exercise_id: string
  position: number
  default_sets: number
}

export interface Supplement {
  id: string
  name: string
  short_name: string | null
  schedule: 'daily' | 'workout'
  optional_on_run_only: boolean
  sort_order: number
  hidden: boolean
  /** 먹은 날 식단 합계에 더할 1회 양(g)·단백질(g)·칼로리(kcal). 쉐이크 등 (6차 검수 요청) */
  serving_g: number | null
  protein_g: number | null
  kcal: number | null
}

/** 하루 한 건. 루틴(다음 차례 계산)과 운동 메모 */
export interface Workout {
  id: string
  date: string
  routine_id: string | null
  memo: string | null
}

export interface WorkoutSet {
  id: string
  date: string
  exercise_id: string
  /** 그날 운동 순서 */
  exercise_pos: number
  set_no: number
  weight_kg: number
  reps: number
}

export interface Run {
  id: string
  date: string
  distance_km: number
  duration_sec: number | null
  memo: string | null
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type MealStatus = 'empty' | 'uploaded' | 'estimated' | 'confirmed' | 'failed'

export interface Meal {
  id: string
  date: string
  slot: MealSlot
  /** 'HH:MM' */
  eaten_at: string | null
  photo_path: string | null
  status: MealStatus
  ai_menu: string | null
  ai_kcal: number | null
  ai_protein_g: number | null
  manual_menu: string | null
  manual_g: number | null
  manual_kcal: number | null
  manual_protein_g: number | null
  memo: string | null
}

/** 사진 AI 분석 결과 (서버 기능 meal-analyze, docs/04-system-design.md 4-1) */
export interface MealEstimate {
  menu: string
  kcal: number
  protein_g: number
  confidence: 'high' | 'medium' | 'low'
}

export interface SupplementLog {
  id: string
  date: string
  supplement_id: string
  /** ISO 시각 */
  taken_at: string
}

export interface Condition {
  id: string
  date: string
  type: 'morning' | 'post_workout'
  fatigue: number | null
  sleep_quality: number | null
  intensity: number | null
  focus: number | null
}

export interface BodyWeight {
  id: string
  date: string
  weight_kg: number
}

export interface InBody {
  id: string
  date: string
  skeletal_muscle_kg: number
  body_fat_pct: number
  body_fat_kg: number | null
  bmr_kcal: number | null
}

export interface Tables {
  exercises: Exercise
  routines: Routine
  routine_items: RoutineItem
  supplements: Supplement
  workouts: Workout
  workout_sets: WorkoutSet
  runs: Run
  meals: Meal
  supplement_logs: SupplementLog
  conditions: Condition
  body_weights: BodyWeight
  inbody: InBody
}

export type TableName = keyof Tables

/** 날짜 칸이 있는 기록 표 (기간으로 불러옴) */
export const datedTables = [
  'workouts',
  'workout_sets',
  'runs',
  'meals',
  'supplement_logs',
  'conditions',
  'body_weights',
  'inbody',
] as const satisfies readonly TableName[]

/** 목록 표 (전부 불러옴) */
export const listTables = ['exercises', 'routines', 'routine_items', 'supplements'] as const satisfies readonly TableName[]

export const allTables: TableName[] = [...listTables, ...datedTables]

export type DB = { [K in TableName]: Map<string, Tables[K]> }
