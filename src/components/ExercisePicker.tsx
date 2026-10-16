// 운동 고르기: 검색 + 부위 탭 + 기구 필터, 최근 한 운동, 여러 개 고르기, 새 운동 만들기 (5차 목업 v2)
import { useMemo, useState } from 'react'
import Icon from './Icon'
import { Check, Sheet } from './ui'
import { shortLabel } from '../lib/dates'
import { fmtKg, fmtNum, recentExercises } from '../lib/domain'
import { newId } from '../lib/ids'
import { upsert, useStore } from '../lib/store'
import type { BodyPart, Equipment, Exercise } from '../lib/types'

export const PARTS: BodyPart[] = ['가슴', '등', '하체', '어깨', '팔', '복근', '유산소']
export const EQUIPS: Equipment[] = ['바벨', '덤벨', '머신', '케이블', '맨몸']

function norm(s: string) {
  return s.replace(/\s+/g, '').toLowerCase()
}

/** 운동 이름·부위·기구로 거르기 */
export function useExerciseFilter(includeHidden = false) {
  const { index } = useStore()
  const [q, setQ] = useState('')
  const [part, setPart] = useState<BodyPart | '전체'>('전체')
  const [equip, setEquip] = useState<Equipment | null>(null)
  const results = useMemo(() => {
    const nq = norm(q)
    return index.exercises
      .filter((e) => includeHidden || !e.hidden)
      .filter((e) => (part === '전체' || e.body_part === part) && (!equip || e.equipment === equip) && (!nq || norm(e.name).includes(nq)))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [index.exercises, q, part, equip, includeHidden])
  return { q, setQ, part, setPart, equip, setEquip, results, filtered: !!q || part !== '전체' || !!equip }
}

export function FilterBar({ f }: { f: ReturnType<typeof useExerciseFilter> }) {
  return (
    <>
      <label className="row" style={{ position: 'relative' }}>
        <span className="sr">운동 검색</span>
        <span style={{ position: 'absolute', left: 12, color: 'var(--muted)', display: 'flex' }}>
          <Icon name="search" />
        </span>
        <input className="field" style={{ paddingLeft: 38 }} placeholder="운동 이름 검색 (예: 로우, 프레스)" value={f.q} onChange={(e) => f.setQ(e.target.value)} />
      </label>
      <div className="tabs-scroll" role="group" aria-label="부위">
        {(['전체', ...PARTS] as const).map((p) => (
          <button key={p} type="button" className={'ptab' + (f.part === p ? ' on' : '')} aria-pressed={f.part === p} onClick={() => f.setPart(p)}>
            {p}
          </button>
        ))}
      </div>
      <div className="chips" role="group" aria-label="기구">
        {EQUIPS.map((e) => (
          <button key={e} type="button" className={'chip' + (f.equip === e ? ' on' : '')} aria-pressed={f.equip === e} onClick={() => f.setEquip(f.equip === e ? null : e)}>
            {e}
          </button>
        ))}
      </div>
    </>
  )
}

/** 운동 이름 옆에 보이는 마지막 기록 */
export function useLastLabel() {
  const { index } = useStore()
  return (e: Exercise) => {
    if (e.kind === 'run') {
      for (let i = index.workoutDates.length - 1; i >= 0; i--) {
        const r = index.days.get(index.workoutDates[i])?.runs[0]
        if (r) return `${shortLabel(r.date)} ${fmtNum(r.distance_km)}km`
      }
      return ''
    }
    const list = index.sessions.get(e.id)
    if (!list?.length) return ''
    const last = list[list.length - 1]
    const top = last.sets.reduce((a, s) => (s.weight_kg > a.weight_kg ? s : a), last.sets[0])
    return `${shortLabel(last.date)} ${fmtKg(top.weight_kg)}×${top.reps}`
  }
}

export function NewExerciseSheet({ initialName, onClose, onCreated }: { initialName: string; onClose: () => void; onCreated: (e: Exercise) => void }) {
  const { apply, index } = useStore()
  const [name, setName] = useState(initialName)
  const [part, setPart] = useState<BodyPart>('가슴')
  const [equip, setEquip] = useState<Equipment>('바벨')
  const trimmed = name.trim()
  const dup = index.exercises.some((e) => norm(e.name) === norm(trimmed))
  const save = () => {
    const ex: Exercise = { id: newId(), name: trimmed, body_part: part, equipment: equip, kind: 'weight', is_custom: true, hidden: false }
    apply([upsert('exercises', [ex])])
    onCreated(ex)
  }
  return (
    <Sheet title="새 운동 만들기" onClose={onClose}>
      <label className="field-label">
        <span className="muted">운동 이름</span>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      {dup && <p className="error">같은 이름의 운동이 이미 있어요</p>}
      <div className="stack-sm">
        <span className="muted">부위</span>
        <div className="chips">
          {PARTS.filter((p) => p !== '유산소').map((p) => (
            <button key={p} type="button" className={'chip' + (part === p ? ' on' : '')} aria-pressed={part === p} onClick={() => setPart(p)}>
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="stack-sm">
        <span className="muted">기구</span>
        <div className="chips">
          {EQUIPS.map((e) => (
            <button key={e} type="button" className={'chip' + (equip === e ? ' on' : '')} aria-pressed={equip === e} onClick={() => setEquip(e)}>
              {e}
            </button>
          ))}
        </div>
      </div>
      <button type="button" className="btn btn-primary" disabled={!trimmed || dup} onClick={save}>
        만들기
      </button>
    </Sheet>
  )
}

export default function ExercisePicker({
  multiple,
  title = '운동 고르기',
  confirmLabel = (n: number) => `${n}개 추가`,
  onDone,
  onCancel,
}: {
  multiple: boolean
  title?: string
  confirmLabel?: (n: number) => string
  onDone: (ids: string[]) => void
  onCancel: () => void
}) {
  const { index, db } = useStore()
  const f = useExerciseFilter()
  const lastLabel = useLastLabel()
  const [picked, setPicked] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const recent = recentExercises(index, 5)
    .map((r) => db.exercises.get(r.exerciseId))
    .filter((e): e is Exercise => !!e && !e.hidden)

  const toggle = (id: string) => {
    if (!multiple) return onDone([id])
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }
  const item = (e: Exercise, keyPrefix = '') => {
    const on = picked.includes(e.id)
    const last = lastLabel(e)
    return (
      <button key={keyPrefix + e.id} type="button" className="list-item" aria-pressed={multiple ? on : undefined} onClick={() => toggle(e.id)}>
        {multiple && <Check done={on} label={on ? '고름' : '안 고름'} />}
        <span className="grow">
          <span className="strong" style={{ display: 'block' }}>
            {e.name}
          </span>
          <span className="muted">
            {e.body_part} · {e.kind === 'run' ? '거리·시간' : e.equipment}
            {e.is_custom ? ' · 내가 만든 운동' : ''}
          </span>
        </span>
        {last && <span className="muted">{last}</span>}
      </button>
    )
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="overlay-inner">
        <button type="button" className="back" onClick={onCancel}>
          <Icon name="left" size={20} />
          취소
        </button>
        <h1>{title}</h1>
        <FilterBar f={f} />
        {!f.filtered && recent.length > 0 && (
          <section className="card" style={{ gap: 0 }}>
            <h2 style={{ marginBottom: 4 }}>최근 한 운동</h2>
            {recent.map((e) => item(e, 'r-'))}
          </section>
        )}
        <section className="card" style={{ gap: 0 }}>
          <h2 style={{ marginBottom: 4 }}>{f.filtered ? `찾은 운동 ${f.results.length}개` : `전체 운동 ${f.results.length}개`}</h2>
          {f.results.map((e) => item(e))}
          {!f.results.length && <p className="muted" style={{ padding: '12px 0' }}>찾는 운동이 없어요.</p>}
          <button type="button" className="list-item" onClick={() => setCreating(true)}>
            <span className="accent-text strong">+ 새 운동 만들기</span>
            {f.q.trim() && <span className="muted">"{f.q.trim()}"</span>}
          </button>
        </section>
      </div>
      {multiple && (
        <div className="overlay-foot">
          <button type="button" className="btn btn-primary" disabled={!picked.length} onClick={() => onDone(picked)}>
            {picked.length ? confirmLabel(picked.length) : '운동을 골라 주세요'}
          </button>
        </div>
      )}
      {creating && (
        <NewExerciseSheet
          initialName={f.q.trim()}
          onClose={() => setCreating(false)}
          onCreated={(e) => {
            setCreating(false)
            f.setQ('')
            if (multiple) setPicked((cur) => [...cur, e.id])
            else onDone([e.id])
          }}
        />
      )}
    </div>
  )
}
