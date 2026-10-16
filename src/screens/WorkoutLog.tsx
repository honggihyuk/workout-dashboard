// 운동 기록: 세트별 지난번 값 표시·미리 채움, 세트 +/−, 운동·러닝 추가, 메모, 운동 후 컨디션, 체중 (5차 목업 v2, U1·U6·U7)
// 러닝은 거리와 평균 페이스로 적고, 시간은 거리 × 페이스로 계산해 저장합니다 (6차 검수 요청).
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ExercisePicker from '../components/ExercisePicker'
import Icon from '../components/Icon'
import { useToast } from '../components/Toast'
import { BackButton, ScoreRow, Sheet, useConfirm, useDateParam } from '../components/ui'
import { longLabel } from '../lib/dates'
import {
  dayOf,
  fmtDuration,
  fmtKg,
  fmtNum,
  fmtPaceSec,
  isRunRoutine,
  lastBefore,
  lastRun,
  lastSession,
  paceOf,
  routineExercises,
  runGoalMet,
  runTargetText,
  runText,
  type Index,
} from '../lib/domain'
import { ids, newId } from '../lib/ids'
import { RUN_EXERCISE_ID } from '../lib/seed'
import { local } from '../lib/storage'
import { remove, upsert, useStore, type Op } from '../lib/store'
import type { DB, Routine, Run, WorkoutSet } from '../lib/types'
import { bigChangeAbs, bigChangeRatio, limits, num, rangeError } from '../lib/validate'

interface SetDraft {
  id?: string
  weight: string
  reps: string
}
interface BlockDraft {
  key: string
  exerciseId: string
  sets: SetDraft[]
}
interface RunDraft {
  key: string
  id?: string
  km: string
  /** 평균 페이스 분·초 (1km당) */
  pm: string
  ps: string
}
interface LogDraft {
  v: 2
  date: string
  routineId: string | null
  blocks: BlockDraft[]
  runs: RunDraft[]
  memo: string
  intensity: number | null
  focus: number | null
  weight: string
}

const draftKey = (date: string) => `wcc.draft.workout.${date}`
const str = (n: number | null | undefined) => (n == null ? '' : String(n))

function makeBlock(index: Index, exerciseId: string, date: string, nSets?: number): BlockDraft {
  const prev = lastSession(index, exerciseId, date)
  const n = nSets ?? prev?.sets.length ?? 3
  const sets: SetDraft[] = Array.from({ length: n }, (_, i) => {
    const p = prev ? (prev.sets[i] ?? prev.sets[prev.sets.length - 1]) : null
    return p ? { weight: str(p.weight_kg), reps: str(p.reps) } : { weight: '', reps: '' }
  })
  return { key: newId(), exerciseId, sets }
}

function paceParts(sec: number | null): { pm: string; ps: string } {
  if (sec == null) return { pm: '', ps: '' }
  const r = Math.round(sec)
  return { pm: String(Math.floor(r / 60)), ps: String(r % 60) }
}

function runDraftFrom(run: Run, keepId: boolean): RunDraft {
  return { key: newId(), id: keepId ? run.id : undefined, km: str(run.distance_km), ...paceParts(paceOf(run)) }
}

/** 새 러닝 칸: 지난번 러닝 값으로 채우고, 지난번이 없으면 루틴 목표로 채움 */
function makeRun(index: Index, date: string, routine?: Routine | null): RunDraft {
  const prev = lastRun(index, date)
  if (prev) return runDraftFrom(prev, false)
  if (routine && isRunRoutine(routine)) return { key: newId(), km: str(routine.target_km), ...paceParts(routine.target_pace_sec) }
  return { key: newId(), km: '', pm: '', ps: '' }
}

/** 칸에 적은 페이스 (1km당 초). 비었으면 null, 숫자가 아니면 NaN */
function draftPace(r: RunDraft): number | null {
  const pm = num(r.pm)
  const ps = num(r.ps)
  if (pm == null && ps == null) return null
  return (pm ?? 0) * 60 + (ps ?? 0)
}

function fromRecords(index: Index, date: string): LogDraft {
  const d = dayOf(index, date)
  const blocks: BlockDraft[] = []
  for (const s of d.sets) {
    let b = blocks[blocks.length - 1]
    if (!b || b.exerciseId !== s.exercise_id) {
      b = { key: newId(), exerciseId: s.exercise_id, sets: [] }
      blocks.push(b)
    }
    b.sets.push({ id: s.id, weight: str(s.weight_kg), reps: str(s.reps) })
  }
  return {
    v: 2,
    date,
    routineId: d.workout?.routine_id ?? null,
    blocks,
    runs: d.runs.map((r) => runDraftFrom(r, true)),
    memo: d.workout?.memo ?? '',
    intensity: d.post?.intensity ?? null,
    focus: d.post?.focus ?? null,
    weight: str(d.weight?.weight_kg),
  }
}

function addExercises(index: Index, draft: LogDraft, exIds: string[]): LogDraft {
  const blocks = [...draft.blocks]
  let runs = draft.runs
  for (const id of exIds) {
    if (id === RUN_EXERCISE_ID) runs = [...runs, makeRun(index, draft.date)]
    else blocks.push(makeBlock(index, id, draft.date))
  }
  return { ...draft, blocks, runs }
}

function initDraft(index: Index, db: DB, date: string, params: URLSearchParams): { draft: LogDraft; restored: boolean } {
  const saved = local.getJSON<LogDraft>(draftKey(date))
  if (saved?.v === 2 && saved.date === date) return { draft: saved, restored: true }
  let draft = fromRecords(index, date)
  const routineId = params.get('routine')
  const routine = routineId ? db.routines.get(routineId) : undefined
  if (routine && isRunRoutine(routine)) {
    draft = { ...draft, routineId: draft.routineId ?? routine.id, runs: draft.runs.length ? draft.runs : [makeRun(index, date, routine)] }
  } else if (routineId && routine) {
    const have = new Set(draft.blocks.map((b) => b.exerciseId))
    const items = routineExercises(db, routineId).filter((it) => !have.has(it.exercise_id))
    draft = {
      ...draft,
      routineId: draft.routineId ?? routineId,
      blocks: [...draft.blocks, ...items.map((it) => makeBlock(index, it.exercise_id, date, it.default_sets))],
    }
  }
  if (params.get('repeat') === 'last') {
    const lastDate = [...index.workoutDates].reverse().find((d) => d < date)
    if (lastDate) {
      const last = dayOf(index, lastDate)
      const counts = new Map<string, number>()
      for (const s of last.sets) counts.set(s.exercise_id, (counts.get(s.exercise_id) ?? 0) + 1)
      draft = {
        ...draft,
        routineId: draft.routineId ?? last.workout?.routine_id ?? null,
        blocks: [...draft.blocks, ...[...counts].map(([exId, n]) => makeBlock(index, exId, date, n))],
        runs: draft.runs.length ? draft.runs : last.runs.map((r) => runDraftFrom(r, false)),
      }
    }
  }
  const add = params.get('add')
  if (add && db.exercises.has(add)) draft = addExercises(index, draft, [add])
  return { draft, restored: false }
}

export default function WorkoutLog() {
  const date = useDateParam()
  const [params] = useSearchParams()
  const { index, db, apply, todayDate } = useStore()
  const navigate = useNavigate()
  const toast = useToast()
  const ask = useConfirm()
  const existing = dayOf(index, date)
  const editing = existing.sets.length > 0 || existing.runs.length > 0

  const [init] = useState(() => initDraft(index, db, date, params))
  const [draft, setDraft] = useState<LogDraft>(init.draft)
  const [restored, setRestored] = useState(init.restored)
  const [dirty, setDirty] = useState(false)
  const [picker, setPicker] = useState<null | { mode: 'add' } | { mode: 'swap'; key: string }>(params.get('pick') === '1' ? { mode: 'add' } : null)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // 입력 중 자동 임시 저장 (U7)
  useEffect(() => {
    if (dirty) local.setJSON(draftKey(date), draft)
  }, [draft, dirty, date])

  const update = (fn: (d: LogDraft) => LogDraft) => {
    setDraft((d) => fn(d))
    setDirty(true)
    setErrors([])
  }
  const updateBlock = (key: string, fn: (b: BlockDraft) => BlockDraft) =>
    update((d) => ({ ...d, blocks: d.blocks.map((b) => (b.key === key ? fn(b) : b)) }))

  const routine = draft.routineId ? db.routines.get(draft.routineId) : undefined
  const routineName = routine?.name ?? null
  const prevRun = useMemo(() => lastRun(index, date), [index, date])
  const prefilled = draft.blocks.some((b) => lastSession(index, b.exerciseId, date)) || (draft.runs.length > 0 && !!prevRun)
  const lastWeight = lastBefore(index.weights, date)
  const updateRun = (key: string, patch: Partial<RunDraft>) => update((d) => ({ ...d, runs: d.runs.map((x) => (x.key === key ? { ...x, ...patch } : x)) }))

  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      const errs: string[] = []
      const warns: string[] = []
      const setRows: WorkoutSet[] = []
      draft.blocks.forEach((b, bi) => {
        const name = db.exercises.get(b.exerciseId)?.name ?? '운동'
        const prev = lastSession(index, b.exerciseId, date)
        let no = 0
        b.sets.forEach((s, si) => {
          const w = num(s.weight)
          const r = num(s.reps)
          if (w == null && r == null) return
          const label = `${name} ${si + 1}세트`
          if (r == null) return void errs.push(`${label}: 횟수를 적어 주세요`)
          const e =
            rangeError(`${label} 무게`, w ?? 0, limits.weight, { unit: 'kg' }) ??
            rangeError(`${label} 횟수`, r, limits.reps, { unit: '회' }) ??
            (Number.isInteger(r) ? null : `${label} 횟수: 정수로 적어 주세요`)
          if (e) return void errs.push(e)
          const pw = prev?.sets[si]?.weight_kg
          if (w != null && bigChangeRatio(pw, w, 0.3)) warns.push(`${label} ${fmtKg(w)}kg (지난번 ${fmtKg(pw!)}kg)`)
          no++
          setRows.push({ id: s.id ?? newId(), date, exercise_id: b.exerciseId, exercise_pos: bi + 1, set_no: no, weight_kg: w ?? 0, reps: r })
        })
      })
      const runRows: Run[] = []
      const prevPace = prevRun ? paceOf(prevRun) : null
      draft.runs.forEach((rd, i) => {
        const km = num(rd.km)
        const pm = num(rd.pm)
        const ps = num(rd.ps)
        if (km == null && pm == null && ps == null) return
        const label = draft.runs.length > 1 ? `러닝 ${i + 1}` : '러닝'
        if (km == null) return void errs.push(`${label}: 거리를 적어 주세요`)
        const e =
          rangeError(`${label} 거리`, km, limits.runKm, { unit: 'km', exclusiveMin: true }) ??
          rangeError(`${label} 페이스 분`, pm, { min: 0, max: 30 }, { unit: '분' }) ??
          rangeError(`${label} 페이스 초`, ps, { min: 0, max: 59 }, { unit: '초' }) ??
          ((pm != null && !Number.isInteger(pm)) || (ps != null && !Number.isInteger(ps)) ? `${label} 페이스: 분과 초를 정수로 적어 주세요` : null)
        if (e) return void errs.push(e)
        const pace = draftPace(rd)
        if (pace != null && (pace < limits.runPaceSec.min || pace > limits.runPaceSec.max))
          return void errs.push(`${label} 페이스: 1km당 2분에서 30분 사이로 적어 주세요`)
        const dur = pace == null ? null : Math.round(pace * km)
        if (dur != null && dur > 86400) return void errs.push(`${label}: 시간이 24시간을 넘어요. 거리와 페이스를 확인해 주세요`)
        if (pace != null && bigChangeRatio(prevPace, pace, 0.3)) warns.push(`${label} 페이스 ${fmtPaceSec(pace)} (지난번 ${fmtPaceSec(prevPace)})`)
        runRows.push({ id: rd.id ?? newId(), date, distance_km: km, duration_sec: dur || null, memo: null })
      })
      if (!errs.length && !setRows.length && !runRows.length) errs.push('운동이나 러닝을 하나 이상 적어 주세요')
      if ((draft.intensity == null) !== (draft.focus == null)) errs.push('운동 후 컨디션: 강도 느낌과 집중도를 둘 다 골라 주세요')
      const bw = num(draft.weight)
      const bwErr = rangeError('체중', bw, limits.bodyWeight, { unit: 'kg' })
      if (bwErr) errs.push(bwErr)
      else if (bw != null && bigChangeAbs(lastWeight?.weight_kg, bw, 3)) warns.push(`체중 ${fmtNum(bw)}kg (지난번 ${fmtNum(lastWeight!.weight_kg)}kg)`)
      if (errs.length) {
        setErrors(errs)
        return
      }
      if (warns.length && !(await ask('지난번과 많이 달라요. 맞나요?', warns))) return

      const keepSets = new Set(setRows.map((s) => s.id))
      const keepRuns = new Set(runRows.map((r) => r.id))
      const ops: Op[] = [
        remove('workout_sets', existing.sets.filter((s) => !keepSets.has(s.id)).map((s) => s.id)),
        remove('runs', existing.runs.filter((r) => !keepRuns.has(r.id)).map((r) => r.id)),
        upsert('workouts', [{ id: ids.workout(date), date, routine_id: draft.routineId, memo: draft.memo.trim() || null }]),
        upsert('workout_sets', setRows),
        upsert('runs', runRows),
      ]
      if (draft.intensity != null && draft.focus != null)
        ops.push(upsert('conditions', [{ id: ids.postWorkout(date), date, type: 'post_workout', fatigue: null, sleep_quality: null, intensity: draft.intensity, focus: draft.focus }]))
      if (bw != null) ops.push(upsert('body_weights', [{ id: ids.bodyWeight(date), date, weight_kg: bw }]))
      else if (existing.weight) ops.push(remove('body_weights', [existing.weight.id]))
      apply(ops)
      local.remove(draftKey(date))
      toast('운동 기록을 저장했어요')
      navigate(date === todayDate ? '/today' : `/today?date=${date}`)
    } finally {
      setSaving(false)
    }
  }

  const deleteDay = () => {
    const before = { sets: existing.sets, runs: existing.runs, workout: existing.workout }
    apply([
      remove('workout_sets', before.sets.map((s) => s.id)),
      remove('runs', before.runs.map((r) => r.id)),
      remove('workouts', before.workout ? [before.workout.id] : []),
    ])
    local.remove(draftKey(date))
    toast('이날 운동 기록을 지웠어요', () =>
      apply([upsert('workout_sets', before.sets), upsert('runs', before.runs), upsert('workouts', before.workout ? [before.workout] : [])]),
    )
    navigate('/workout')
  }

  const menuBlock = draft.blocks.find((b) => b.key === menuFor)
  const menuIndex = draft.blocks.findIndex((b) => b.key === menuFor)

  return (
    <>
      <BackButton to="/workout" label="운동" />
      <div className="stack-sm">
        <span className="muted">{longLabel(date)}</span>
        <h1>{routineName ?? '운동 기록'}</h1>
        {prefilled && !editing && <p className="muted">모든 칸은 지난번 값으로 채워져 있어요. 달라진 칸만 고치세요.</p>}
      </div>
      {restored && (
        <div className="banner info">
          <span>작성 중이던 기록을 불러왔어요</span>
          <button
            type="button"
            className="btn btn-link"
            onClick={() => {
              local.remove(draftKey(date))
              setDraft(initDraft(index, db, date, params).draft)
              setRestored(false)
              setDirty(false)
            }}
          >
            처음부터
          </button>
        </div>
      )}

      {draft.blocks.map((b) => {
        const ex = db.exercises.get(b.exerciseId)
        const prev = lastSession(index, b.exerciseId, date)
        const bodyweight = ex?.equipment === '맨몸'
        return (
          <section key={b.key} className="card" aria-label={ex?.name}>
            <div className="row">
              <div className="grow">
                <h2>{ex?.name ?? '지워진 운동'}</h2>
                <span className="muted">
                  {ex ? `${ex.body_part} · ${ex.equipment}` : ''}
                  {!prev && ' · 첫 기록입니다'}
                </span>
              </div>
              <button type="button" className="icon-btn" aria-label={`${ex?.name} 메뉴 (순서 바꾸기, 다른 운동으로 바꾸기, 빼기)`} onClick={() => setMenuFor(b.key)}>
                <Icon name="more" size={22} />
              </button>
            </div>
            <div className="set-grid muted" aria-hidden="true">
              <span className="center">세트</span>
              <span>지난번</span>
              <span className="center">kg</span>
              <span className="center">회</span>
            </div>
            {b.sets.map((s, i) => {
              const p = prev?.sets[i]
              return (
                <div key={i} className="set-grid">
                  <span className="set-no">{i + 1}</span>
                  <span className="muted">{p ? `${fmtKg(p.weight_kg)}×${p.reps}` : '–'}</span>
                  <label>
                    <span className="sr">{i + 1}세트 무게 (kg)</span>
                    <input
                      className="field num"
                      inputMode="decimal"
                      placeholder={bodyweight ? '맨몸' : 'kg'}
                      value={s.weight}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => updateBlock(b.key, (bb) => ({ ...bb, sets: bb.sets.map((x, k) => (k === i ? { ...x, weight: e.target.value } : x)) }))}
                    />
                  </label>
                  <label>
                    <span className="sr">{i + 1}세트 횟수</span>
                    <input
                      className="field num"
                      inputMode="numeric"
                      placeholder="회"
                      value={s.reps}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => updateBlock(b.key, (bb) => ({ ...bb, sets: bb.sets.map((x, k) => (k === i ? { ...x, reps: e.target.value } : x)) }))}
                    />
                  </label>
                </div>
              )
            })}
            <div className="row-sm">
              <button
                type="button"
                className="chip"
                onClick={() =>
                  updateBlock(b.key, (bb) => {
                    const i = bb.sets.length
                    const p = prev?.sets[i]
                    const last = bb.sets[i - 1]
                    const next = p ? { weight: str(p.weight_kg), reps: str(p.reps) } : { weight: last?.weight ?? '', reps: last?.reps ?? '' }
                    return { ...bb, sets: [...bb.sets, next] }
                  })
                }
              >
                + 세트
              </button>
              <button type="button" className="chip" disabled={b.sets.length <= 1} onClick={() => updateBlock(b.key, (bb) => ({ ...bb, sets: bb.sets.slice(0, -1) }))}>
                − 세트
              </button>
            </div>
          </section>
        )
      })}

      {draft.runs.map((r, i) => {
        const km = num(r.km)
        const pace = draftPace(r)
        const ok = km != null && km > 0 && pace != null && pace >= limits.runPaceSec.min && pace <= limits.runPaceSec.max
        const run = ok ? { distance_km: km, duration_sec: Math.round(pace * km) } : null
        const goal = run ? runGoalMet(run, routine) : null
        return (
          <section key={r.key} className="card" aria-label="러닝">
            <div className="row">
              <div className="grow">
                <h2>러닝</h2>
                {prevRun && i === 0 && <span className="muted">지난번 {runText(prevRun)}</span>}
                {isRunRoutine(routine) && i === 0 && (
                  <span className="muted" style={{ display: 'block' }}>
                    {runTargetText(routine!)}
                  </span>
                )}
              </div>
              <button type="button" className="icon-btn" aria-label="러닝 빼기" onClick={() => update((d) => ({ ...d, runs: d.runs.filter((x) => x.key !== r.key) }))}>
                <Icon name="close" />
              </button>
            </div>
            <div className="run-inputs">
              <label className="field-label">
                <span className="muted">거리 (km)</span>
                <input className="field num run-big" inputMode="decimal" placeholder="0.00" value={r.km} onFocus={(e) => e.currentTarget.select()} onChange={(e) => updateRun(r.key, { km: e.target.value })} />
              </label>
              <div className="field-label">
                <span className="muted">평균 페이스 (1km당)</span>
                <div className="pace-input">
                  <label>
                    <span className="sr">페이스 분</span>
                    <input className="field num run-big" inputMode="numeric" placeholder="분" value={r.pm} onFocus={(e) => e.currentTarget.select()} onChange={(e) => updateRun(r.key, { pm: e.target.value })} />
                  </label>
                  <span className="pace-mark" aria-hidden="true">
                    &#39;
                  </span>
                  <label>
                    <span className="sr">페이스 초</span>
                    <input className="field num run-big" inputMode="numeric" placeholder="초" value={r.ps} onFocus={(e) => e.currentTarget.select()} onChange={(e) => updateRun(r.key, { ps: e.target.value })} />
                  </label>
                  <span className="pace-mark" aria-hidden="true">
                    &quot;
                  </span>
                </div>
              </div>
            </div>
            <div className="row between run-result">
              <span className="muted">
                시간 <span className="strong run-time">{run ? fmtDuration(run.duration_sec) : '–'}</span>
                <span className="small"> · 거리 × 페이스로 계산</span>
              </span>
              {goal && <span className="badge badge-good">목표 달성</span>}
            </div>
          </section>
        )
      })}

      <div className="grid2">
        <button type="button" className="btn btn-ghost" onClick={() => setPicker({ mode: 'add' })}>
          + 운동 추가
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => update((d) => ({ ...d, runs: [...d.runs, makeRun(index, date, routine)] }))}>
          + 러닝 추가
        </button>
      </div>

      <section className="card">
        <label className="field-label">
          <span className="strong small">메모</span>
          <textarea className="field" placeholder="예: 어깨가 조금 뻐근했음" value={draft.memo} onChange={(e) => update((d) => ({ ...d, memo: e.target.value }))} />
        </label>
      </section>

      <section className="card" aria-label="운동 후 컨디션">
        <h2>운동 후 컨디션</h2>
        <ScoreRow label="운동 강도 느낌" hint="1 가벼움 · 5 매우 힘듦" value={draft.intensity} onChange={(n) => update((d) => ({ ...d, intensity: n }))} />
        <ScoreRow label="집중도" hint="1 낮음 · 5 높음" value={draft.focus} onChange={(n) => update((d) => ({ ...d, focus: n }))} />
      </section>

      <section className="card">
        <label className="field-label">
          <span className="row between">
            <span className="strong small">체중 (kg)</span>
            <span className="muted">선택 · 이틀에 한 번</span>
          </span>
          <input
            className="field"
            inputMode="decimal"
            placeholder={lastWeight ? `지난번 ${fmtNum(lastWeight.weight_kg)}` : '예: 76.4'}
            value={draft.weight}
            onChange={(e) => update((d) => ({ ...d, weight: e.target.value }))}
          />
        </label>
      </section>

      {errors.length > 0 && (
        <div className="banner" role="alert" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          {errors.map((e) => (
            <span key={e}>{e}</span>
          ))}
        </div>
      )}
      <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
        {saving ? '저장 중…' : '저장'}
      </button>
      {editing && (
        <button type="button" className="btn btn-quiet btn-danger" onClick={deleteDay}>
          이날 운동 기록 지우기
        </button>
      )}

      {menuBlock && (
        <Sheet title={db.exercises.get(menuBlock.exerciseId)?.name ?? '운동'} onClose={() => setMenuFor(null)}>
          <div className="grid2">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={menuIndex <= 0}
              onClick={() =>
                update((d) => {
                  const b = [...d.blocks]
                  ;[b[menuIndex - 1], b[menuIndex]] = [b[menuIndex], b[menuIndex - 1]]
                  return { ...d, blocks: b }
                })
              }
            >
              <Icon name="up" /> 위로
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={menuIndex >= draft.blocks.length - 1}
              onClick={() =>
                update((d) => {
                  const b = [...d.blocks]
                  ;[b[menuIndex + 1], b[menuIndex]] = [b[menuIndex], b[menuIndex + 1]]
                  return { ...d, blocks: b }
                })
              }
            >
              <Icon name="down" /> 아래로
            </button>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setPicker({ mode: 'swap', key: menuBlock.key })
              setMenuFor(null)
            }}
          >
            <Icon name="swap" /> 다른 운동으로 바꾸기
          </button>
          <button
            type="button"
            className="btn btn-quiet btn-danger"
            onClick={() => {
              const removed = menuBlock
              const at = menuIndex
              update((d) => ({ ...d, blocks: d.blocks.filter((b) => b.key !== removed.key) }))
              setMenuFor(null)
              toast(`${db.exercises.get(removed.exerciseId)?.name ?? '운동'}을(를) 뺐어요`, () =>
                update((d) => {
                  const b = [...d.blocks]
                  b.splice(at, 0, removed)
                  return { ...d, blocks: b }
                }),
              )
            }}
          >
            이 운동 빼기
          </button>
        </Sheet>
      )}

      {picker && (
        <ExercisePicker
          multiple={picker.mode === 'add'}
          title={picker.mode === 'add' ? '운동 고르기' : '바꿀 운동 고르기'}
          onCancel={() => setPicker(null)}
          onDone={(picked) => {
            if (picker.mode === 'add') update((d) => addExercises(index, d, picked))
            else if (picked[0] === RUN_EXERCISE_ID)
              update((d) => ({ ...d, blocks: d.blocks.filter((b) => b.key !== picker.key), runs: [...d.runs, makeRun(index, date, routine)] }))
            else
              updateBlock(picker.key, (b) => ({ ...makeBlock(index, picked[0], date, b.sets.length), key: b.key }))
            setPicker(null)
          }}
        />
      )}
    </>
  )
}
