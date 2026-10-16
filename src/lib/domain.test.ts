// 계산 규칙 시험: 2차 3장 상태 정의, 1차 KPI, 5차 다음 차례
import { describe, expect, it } from 'vitest'
import { addMonths, weekStart } from './dates'
import { toDB } from './data/repo'
import { dayStatus, fmtPaceSec, inbodyVerdict, buildIndex, lastSession, paceOf, routineRotation, runBests, runGoalMet, runTotals, weeklyKpi } from './domain'
import { ids } from './ids'
import { RUN_ROUTINE_ID, seedExercises, seedRoutineItems, seedRoutines, seedSupplements } from './seed'
import type { Condition, Meal, MealSlot, Run, SupplementLog, Tables, WorkoutSet } from './types'

const TODAY = '2026-10-15' // 목요일

const meal = (date: string, slot: MealSlot, photo = true): Meal => ({
  id: ids.meal(date, slot),
  date,
  slot,
  eaten_at: null,
  photo_path: photo ? `${date}/${slot}.jpg` : null,
  status: photo ? 'uploaded' : 'empty',
  ai_menu: null,
  ai_kcal: null,
  ai_protein_g: null,
  manual_menu: null,
  manual_g: null,
  manual_kcal: null,
  manual_protein_g: null,
  memo: null,
})
const log = (date: string, sid: string): SupplementLog => ({ id: ids.supplementLog(date, sid), date, supplement_id: sid, taken_at: date + 'T08:00:00+09:00' })
const morning = (date: string): Condition => ({ id: ids.morning(date), date, type: 'morning', fatigue: 2, sleep_quality: 4, intensity: null, focus: null })
const post = (date: string): Condition => ({ id: ids.postWorkout(date), date, type: 'post_workout', fatigue: null, sleep_quality: null, intensity: 4, focus: 3 })
const set = (date: string, ex: string, n: number, w: number, r: number): WorkoutSet => ({ id: `${date}-${ex}-${n}`, date, exercise_id: ex, exercise_pos: 1, set_no: n, weight_kg: w, reps: r })
const daily = seedSupplements.filter((s) => s.schedule === 'daily').map((s) => s.id)
const workoutSupps = seedSupplements.filter((s) => s.schedule === 'workout').map((s) => s.id)

function make(rows: Partial<{ [K in keyof Tables]: Tables[K][] }>) {
  const db = toDB({ exercises: seedExercises, supplements: seedSupplements, routines: seedRoutines, routine_items: seedRoutineItems, ...rows })
  return { db, index: buildIndex(db) }
}

function fullRestDay(date: string) {
  return {
    meals: (['breakfast', 'lunch', 'dinner'] as const).map((s) => meal(date, s)),
    supplement_logs: daily.map((s) => log(date, s)),
    conditions: [morning(date)],
  }
}

describe('하루 루틴 상태', () => {
  it('쉬는 날: 아침 컨디션 + 식사 3끼 + 영양제면 완료 (보충제는 빠짐)', () => {
    const { index } = make(fullRestDay('2026-10-14'))
    const st = dayStatus(index, '2026-10-14', TODAY)
    expect(st.isWorkoutDay).toBe(false)
    expect(st.state).toBe('done')
  })

  it('헬스한 날: 운동 후 컨디션, 보충제 4종(쉐이크 포함)이 더 필요', () => {
    const date = '2026-10-14'
    const base = fullRestDay(date)
    const { index } = make({ ...base, workout_sets: [set(date, 'bench_press', 1, 70, 8)] })
    const st = dayStatus(index, date, TODAY)
    expect(st.isWorkoutDay).toBe(true)
    expect(st.state).toBe('missed')
    expect(st.missing).toEqual(['운동 후 컨디션', '보충제·쉐이크'])

    const done = make({
      ...base,
      workout_sets: [set(date, 'bench_press', 1, 70, 8)],
      conditions: [...base.conditions, post(date)],
      supplement_logs: [...base.supplement_logs, ...workoutSupps.map((s) => log(date, s))],
    })
    expect(dayStatus(done.index, date, TODAY).state).toBe('done')
  })

  it('러닝만 한 날: 쉐이크는 선택이라 없어도 완료', () => {
    const date = '2026-10-14'
    const base = fullRestDay(date)
    const { index } = make({
      ...base,
      runs: [{ id: 'r1', date, distance_km: 7, duration_sec: 2400, memo: null }],
      conditions: [...base.conditions, post(date)],
      supplement_logs: [...base.supplement_logs, ...['creatine', 'eaa', 'glutamine'].map((s) => log(date, s))],
    })
    const st = dayStatus(index, date, TODAY)
    expect(st.isRunOnly).toBe(true)
    expect(st.state).toBe('done')
  })

  it('지난날 기록이 하나도 없으면 "기록 없음", 일부만 있으면 "놓친 항목 있음"', () => {
    const { index } = make({ conditions: [morning('2026-10-13')] })
    expect(dayStatus(index, '2026-10-12', TODAY).state).toBe('empty')
    expect(dayStatus(index, '2026-10-13', TODAY).state).toBe('missed')
  })

  it('오늘은 진행 중, 내일은 미래', () => {
    const { index } = make({})
    expect(dayStatus(index, TODAY, TODAY).state).toBe('in_progress')
    expect(dayStatus(index, '2026-10-16', TODAY).state).toBe('future')
  })

  it('나중에 채우면 놓친 항목 있음 → 완료', () => {
    const date = '2026-10-10'
    const partial = make({ conditions: [morning(date)] })
    expect(dayStatus(partial.index, date, TODAY).state).toBe('missed')
    const filled = make(fullRestDay(date))
    expect(dayStatus(filled.index, date, TODAY).state).toBe('done')
  })

  it('식사는 사진 없이 칼로리만 적어도 채운 것으로 봄', () => {
    const date = '2026-10-14'
    const m = { ...meal(date, 'dinner', false), manual_kcal: 600, status: 'confirmed' as const }
    const { index } = make({ meals: [meal(date, 'breakfast'), meal(date, 'lunch'), m], supplement_logs: daily.map((s) => log(date, s)), conditions: [morning(date)] })
    expect(dayStatus(index, date, TODAY).state).toBe('done')
  })
})

describe('주간 KPI', () => {
  it('월요일 시작 주의 운동 횟수와 식사 사진 끼 수 (간식 제외)', () => {
    const { index } = make({
      workout_sets: [set('2026-10-12', 'squat', 1, 80, 8), set('2026-10-14', 'squat', 1, 82.5, 8), set('2026-10-11', 'squat', 1, 80, 8)],
      runs: [{ id: 'r', date: '2026-10-13', distance_km: 5, duration_sec: null, memo: null }],
      meals: [meal('2026-10-12', 'breakfast'), meal('2026-10-12', 'snack'), meal('2026-10-15', 'lunch')],
    })
    const k = weeklyKpi(index, TODAY)
    expect(k.weekStart).toBe('2026-10-12')
    expect(k.workoutCount).toBe(3)
    expect(k.mealCount).toBe(2)
    expect(k.mealGoal).toBe(14)
  })

  it('인바디: 골격근량 유지·증가 좋음, 체지방률 감소 좋음 / 유지는 주의', () => {
    const ib = (date: string, m: number, f: number) => ({ id: ids.inbody(date), date, skeletal_muscle_kg: m, body_fat_pct: f, body_fat_kg: null, bmr_kcal: null })
    const a = make({ inbody: [ib('2026-09-03', 34, 16), ib('2026-10-03', 34, 15.5)] })
    expect(inbodyVerdict(a.index, TODAY)).toMatchObject({ muscle: 'good', fat: 'good' })
    const b = make({ inbody: [ib('2026-09-03', 34, 16), ib('2026-10-03', 33.8, 16)] })
    expect(inbodyVerdict(b.index, TODAY)).toMatchObject({ muscle: 'warn', fat: 'warn' })
    const c = make({ inbody: [ib('2026-10-03', 34, 16)] })
    expect(inbodyVerdict(c.index, TODAY)).toMatchObject({ prev: null, muscle: null })
  })
})

describe('운동', () => {
  it('다음 차례: 마지막으로 한 루틴의 다음, 마지막 다음은 처음', () => {
    const none = make({})
    expect(routineRotation(none.index, none.db).next?.id).toBe('r_chest_tri')
    const one = make({ workouts: [{ id: 'w1', date: '2026-10-13', routine_id: 'r_back_bi', memo: null }] })
    expect(routineRotation(one.index, one.db).next?.id).toBe('r_leg_shoulder')
    const wrap = make({
      workouts: [
        { id: 'w1', date: '2026-10-13', routine_id: 'r_back_bi', memo: null },
        { id: 'w2', date: '2026-10-14', routine_id: 'r_leg_shoulder', memo: null },
      ],
    })
    expect(routineRotation(wrap.index, wrap.db).next?.id).toBe('r_chest_tri')
  })

  it('다음 차례: 러닝 루틴은 순서에 끼지 않음', () => {
    const { index, db } = make({
      workouts: [
        { id: 'w1', date: '2026-10-13', routine_id: 'r_back_bi', memo: null },
        { id: 'w2', date: '2026-10-14', routine_id: RUN_ROUTINE_ID, memo: null },
      ],
    })
    const { next, list } = routineRotation(index, db)
    expect(next?.id).toBe('r_leg_shoulder')
    expect(list.find((r) => r.routine.id === RUN_ROUTINE_ID)?.lastDate).toBe('2026-10-14')
  })

  it('지난번 값: 기록하는 날보다 앞선 마지막 기록', () => {
    const { index } = make({ workout_sets: [set('2026-10-08', 'bench_press', 1, 70, 8), set('2026-10-12', 'bench_press', 1, 72.5, 8), set('2026-10-15', 'bench_press', 1, 75, 6)] })
    expect(lastSession(index, 'bench_press', '2026-10-15')?.date).toBe('2026-10-12')
    expect(lastSession(index, 'bench_press', '2026-10-12')?.volume).toBe(560)
    expect(lastSession(index, 'squat', TODAY)).toBeNull()
  })
})

describe('러닝', () => {
  const run = (date: string, km: number, sec: number | null): Run => ({ id: `run-${date}`, date, distance_km: km, duration_sec: sec, memo: null })

  it('평균 페이스는 시간 ÷ 거리, 거리 × 페이스로 저장한 시간에서 같은 페이스가 나옴', () => {
    expect(fmtPaceSec(paceOf(run(TODAY, 5, 1650)))).toBe(`5'30"/km`)
    expect(paceOf(run(TODAY, 5, null))).toBeNull()
    for (const [km, pace] of [[5.2, 341], [7.3, 333], [10, 299], [1, 412]] as const) {
      const dur = Math.round(km * pace)
      expect(Math.round(paceOf(run(TODAY, km, dur))!)).toBe(pace)
    }
  })

  it('합계와 최고 기록: 시간을 안 적은 날은 페이스 계산에서 빠짐', () => {
    const runs = [run('2026-10-03', 5, 1750), run('2026-10-10', 8, 2720), run('2026-10-11', 3, null), run('2026-10-12', 0.5, 120)]
    const t = runTotals(runs)
    expect(t.count).toBe(4)
    expect(t.km).toBeCloseTo(16.5)
    expect(t.pace).toBeCloseTo((1750 + 2720 + 120) / 13.5)
    const b = runBests(runs)
    expect(b.longest?.date).toBe('2026-10-10')
    expect(b.fastest?.date).toBe('2026-10-10') // 0.5km는 1km 미만이라 빠짐
  })

  it('목표 달성: 목표 거리 이상, 목표 페이스 이하', () => {
    const routine = { ...seedRoutines.find((r) => r.id === RUN_ROUTINE_ID)!, target_km: 5, target_pace_sec: 350 }
    expect(runGoalMet(run(TODAY, 5, 1750), routine)).toBe(true)
    expect(runGoalMet(run(TODAY, 5, 1760), routine)).toBe(false)
    expect(runGoalMet(run(TODAY, 4.9, 1500), routine)).toBe(false)
    expect(runGoalMet(run(TODAY, 5, 1750), seedRoutines[0])).toBeNull()
  })
})

describe('날짜', () => {
  it('한 주는 월요일 시작, 월 더하기는 말일 보정', () => {
    expect(weekStart('2026-10-18')).toBe('2026-10-12')
    expect(weekStart('2026-10-12')).toBe('2026-10-12')
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
  })
})

describe('기본 목록', () => {
  it('기본 운동 약 100개, id 중복 없음, 루틴 운동은 모두 목록에 있음', () => {
    const idsSet = new Set(seedExercises.map((e) => e.id))
    expect(idsSet.size).toBe(seedExercises.length)
    expect(seedExercises.length).toBeGreaterThanOrEqual(95)
    for (const it of seedRoutineItems) expect(idsSet.has(it.exercise_id)).toBe(true)
    expect(seedRoutineItems.some((it) => it.routine_id === RUN_ROUTINE_ID)).toBe(false)
    expect(new Set(seedExercises.map((e) => e.name)).size).toBe(seedExercises.length)
  })
})
