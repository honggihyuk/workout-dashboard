// 루틴 편집: 루틴 고르기, 이름, 운동 순서 위/아래, 세트 수 +/−, 빼기, 운동 추가 (5차 목업 v2)
// 러닝 루틴: 운동 목록 대신 목표 거리·평균 페이스 (6차 검수 요청)
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ExercisePicker from '../components/ExercisePicker'
import Icon from '../components/Icon'
import { useToast } from '../components/Toast'
import { BackButton } from '../components/ui'
import { fmtDuration, fmtNum, isRunRoutine, routineExercises } from '../lib/domain'
import { newId } from '../lib/ids'
import { RUN_EXERCISE_ID } from '../lib/seed'
import { remove, upsert, useStore } from '../lib/store'
import type { DB, Routine, RoutineKind } from '../lib/types'
import { limits, num, rangeError } from '../lib/validate'

interface Item {
  id?: string
  exerciseId: string
  sets: number
}

interface Form {
  name: string
  kind: RoutineKind
  items: Item[]
  /** 러닝 루틴 목표 (선택) */
  km: string
  pm: string
  ps: string
}

function load(db: DB, routineId: string | null): Form {
  const r = routineId ? db.routines.get(routineId) : undefined
  if (!r) return { name: '', kind: 'weight', items: [], km: '', pm: '', ps: '' }
  const pace = r.target_pace_sec
  return {
    name: r.name,
    kind: isRunRoutine(r) ? 'run' : 'weight',
    items: routineExercises(db, r.id).map((it) => ({ id: it.id, exerciseId: it.exercise_id, sets: it.default_sets })),
    km: r.target_km == null ? '' : String(r.target_km),
    pm: pace == null ? '' : String(Math.floor(pace / 60)),
    ps: pace == null ? '' : String(pace % 60),
  }
}

export default function RoutineEdit() {
  const { db, index, apply } = useStore()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const routines = index.routines
  const startId = params.get('new') === '1' ? null : (params.get('id') ?? routines[0]?.id ?? null)
  const [routineId, setRoutineId] = useState<string | null>(startId)
  const [form, setForm] = useState<Form>(() => load(db, startId))
  const isRun = form.kind === 'run'
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const select = (id: string | null) => {
    setRoutineId(id)
    setForm(load(db, id))
    setError(null)
  }
  const setItems = (fn: (items: Item[]) => Item[]) => setForm((f) => ({ ...f, items: fn(f.items) }))
  const move = (i: number, d: number) =>
    setItems((items) => {
      const j = i + d
      if (j < 0 || j >= items.length) return items
      const next = [...items]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  const total = form.items.reduce((a, x) => a + x.sets, 0)

  const save = () => {
    const name = form.name.trim()
    if (!name) return setError('루틴 이름을 적어 주세요')
    if (!isRun && !form.items.length) return setError('운동을 하나 이상 넣어 주세요')
    let targetKm: number | null = null
    let targetPace: number | null = null
    if (isRun) {
      targetKm = num(form.km)
      const pm = num(form.pm)
      const ps = num(form.ps)
      const e =
        rangeError('목표 거리', targetKm, limits.runKm, { unit: 'km', exclusiveMin: true }) ??
        rangeError('목표 페이스 분', pm, { min: 0, max: 30 }, { unit: '분' }) ??
        rangeError('목표 페이스 초', ps, { min: 0, max: 59 }, { unit: '초' }) ??
        ((pm != null && !Number.isInteger(pm)) || (ps != null && !Number.isInteger(ps)) ? '목표 페이스: 분과 초를 정수로 적어 주세요' : null)
      if (e) return setError(e)
      targetPace = pm == null && ps == null ? null : (pm ?? 0) * 60 + (ps ?? 0)
      if (targetPace != null && (targetPace < limits.runPaceSec.min || targetPace > limits.runPaceSec.max))
        return setError('목표 페이스: 1km당 2분에서 30분 사이로 적어 주세요')
    }
    const id = routineId ?? newId()
    const routine: Routine = {
      id,
      name,
      sort_order: routineId ? (db.routines.get(routineId)?.sort_order ?? 1) : Math.max(0, ...routines.map((r) => r.sort_order)) + 1,
      kind: form.kind,
      target_km: targetKm,
      target_pace_sec: targetPace,
    }
    const items = isRun ? [] : form.items.map((it, i) => ({ id: it.id ?? newId(), routine_id: id, exercise_id: it.exerciseId, position: i + 1, default_sets: it.sets }))
    const keep = new Set(items.map((i) => i.id))
    const old = routineId ? routineExercises(db, routineId) : []
    apply([upsert('routines', [routine]), remove('routine_items', old.filter((o) => !keep.has(o.id)).map((o) => o.id)), upsert('routine_items', items)])
    toast(`${name} 루틴을 저장했어요`)
    navigate('/workout')
  }

  const deleteRoutine = () => {
    if (!routineId) return
    const routine = db.routines.get(routineId)!
    const items = routineExercises(db, routineId)
    apply([remove('routine_items', items.map((i) => i.id)), remove('routines', [routineId])])
    toast(`${routine.name} 루틴을 지웠어요`, () => apply([upsert('routines', [routine]), upsert('routine_items', items)]))
    const next = routines.find((r) => r.id !== routineId)?.id ?? null
    select(next)
  }

  return (
    <>
      <BackButton to="/workout" label="운동" />
      <h1>루틴 편집</h1>
      <div className="chips" role="group" aria-label="내 루틴">
        {routines.map((r) => (
          <button key={r.id} type="button" className={'chip' + (routineId === r.id ? ' on' : '')} aria-pressed={routineId === r.id} onClick={() => select(r.id)}>
            {r.name}
          </button>
        ))}
        <button type="button" className={'chip' + (routineId === null ? ' on' : '')} aria-pressed={routineId === null} onClick={() => select(null)}>
          + 새 루틴
        </button>
      </div>

      {routineId === null && (
        <div className="seg" role="group" aria-label="루틴 종류">
          {(
            [
              ['weight', '헬스'],
              ['run', '러닝'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" className={form.kind === k ? 'on' : ''} aria-pressed={form.kind === k} onClick={() => setForm((f) => ({ ...f, kind: k }))}>
              {label}
            </button>
          ))}
        </div>
      )}

      <label className="field-label">
        <span className="muted">루틴 이름</span>
        <input className="field" placeholder={isRun ? '예: 러닝 5km' : '예: 가슴·삼두'} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </label>

      {isRun ? (
        <RunTargets form={form} setForm={setForm} />
      ) : (
        <>
      <div className="section-title">
        <h2>운동 순서와 세트 수</h2>
        <span className="muted">
          {form.items.length}종목 · {total}세트
        </span>
      </div>
      <section className="card" style={{ gap: 0, padding: '4px 12px' }}>
        {!form.items.length && <p className="muted" style={{ padding: '12px 0' }}>아래에서 운동을 추가해 주세요.</p>}
        {form.items.map((it, i) => {
          const ex = db.exercises.get(it.exerciseId)
          return (
            <div key={(it.id ?? '') + it.exerciseId + i} className="list-item" style={{ gap: 6 }}>
              <div className="stack-sm" style={{ gap: 0 }}>
                <button type="button" className="icon-btn" style={{ height: 30 }} aria-label={`${ex?.name} 위로`} disabled={i === 0} onClick={() => move(i, -1)}>
                  <Icon name="up" />
                </button>
                <button type="button" className="icon-btn" style={{ height: 30 }} aria-label={`${ex?.name} 아래로`} disabled={i === form.items.length - 1} onClick={() => move(i, 1)}>
                  <Icon name="down" />
                </button>
              </div>
              <span className="grow">
                <span className="strong" style={{ display: 'block' }}>
                  {ex?.name ?? '지워진 운동'}
                </span>
                <span className="muted">{ex ? `${ex.body_part} · ${ex.equipment}` : ''}</span>
              </span>
              <span className="stepper" role="group" aria-label={`${ex?.name} 세트 수`}>
                <button type="button" aria-label="세트 줄이기" disabled={it.sets <= 1} onClick={() => setItems((items) => items.map((x, k) => (k === i ? { ...x, sets: x.sets - 1 } : x)))}>
                  −
                </button>
                <span>{it.sets}세트</span>
                <button type="button" aria-label="세트 늘리기" disabled={it.sets >= 10} onClick={() => setItems((items) => items.map((x, k) => (k === i ? { ...x, sets: x.sets + 1 } : x)))}>
                  +
                </button>
              </span>
              <button type="button" className="icon-btn" aria-label={`${ex?.name} 빼기`} onClick={() => setItems((items) => items.filter((_, k) => k !== i))}>
                <Icon name="close" />
              </button>
            </div>
          )
        })}
      </section>
      <button type="button" className="btn btn-ghost" onClick={() => setPicking(true)}>
        + 운동 추가
      </button>
      <p className="muted">무게와 횟수는 루틴에 적지 않아요. 기록할 때 지난번 값이 자동으로 채워져요. 루틴은 적어 둔 순서대로 돌아가며 "다음 차례"가 정해져요.</p>
        </>
      )}
      {error && <p className="error">{error}</p>}
      <button type="button" className="btn btn-primary" onClick={save}>
        저장
      </button>
      {routineId && (
        <button type="button" className="btn btn-quiet btn-danger" onClick={deleteRoutine}>
          이 루틴 지우기
        </button>
      )}

      {picking && (
        <ExercisePicker
          multiple
          onCancel={() => setPicking(false)}
          onDone={(picked) => {
            setItems((items) => [...items, ...picked.filter((id) => id !== RUN_EXERCISE_ID).map((exerciseId) => ({ exerciseId, sets: 3 }))])
            if (picked.includes(RUN_EXERCISE_ID)) toast('러닝은 "+ 새 루틴"에서 러닝 루틴으로 만들어요')
            setPicking(false)
          }}
        />
      )}
    </>
  )
}

/** 러닝 루틴: 목표 거리·평균 페이스 (선택) */
function RunTargets({ form, setForm }: { form: Form; setForm: React.Dispatch<React.SetStateAction<Form>> }) {
  const km = num(form.km)
  const pm = num(form.pm)
  const ps = num(form.ps)
  const pace = pm == null && ps == null ? null : (pm ?? 0) * 60 + (ps ?? 0)
  const time = km && pace && Number.isFinite(km * pace) ? Math.round(km * pace) : null
  return (
    <>
      <div className="section-title">
        <h2>목표</h2>
        <span className="muted">선택</span>
      </div>
      <section className="card">
        <div className="run-inputs">
          <label className="field-label">
            <span className="muted">목표 거리 (km)</span>
            <input className="field num run-big" inputMode="decimal" placeholder="5" value={form.km} onChange={(e) => setForm((f) => ({ ...f, km: e.target.value }))} />
          </label>
          <div className="field-label">
            <span className="muted">목표 평균 페이스 (1km당)</span>
            <div className="pace-input">
              <label>
                <span className="sr">목표 페이스 분</span>
                <input className="field num run-big" inputMode="numeric" placeholder="분" value={form.pm} onChange={(e) => setForm((f) => ({ ...f, pm: e.target.value }))} />
              </label>
              <span className="pace-mark" aria-hidden="true">
                &#39;
              </span>
              <label>
                <span className="sr">목표 페이스 초</span>
                <input className="field num run-big" inputMode="numeric" placeholder="초" value={form.ps} onChange={(e) => setForm((f) => ({ ...f, ps: e.target.value }))} />
              </label>
              <span className="pace-mark" aria-hidden="true">
                &quot;
              </span>
            </div>
          </div>
        </div>
        {time != null && (
          <span className="muted">
            이 목표면 {fmtNum(km!, 2)}km를 약 {fmtDuration(time)}에 달려요
          </span>
        )}
      </section>
      <p className="muted">
        기록할 때는 달린 거리와 평균 페이스만 적으면 시간은 자동으로 계산돼요. 러닝 루틴은 헬스 루틴의 "다음 차례" 순서에 끼지 않아요.
      </p>
    </>
  )
}
