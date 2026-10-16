// 설정 → 운동 목록: 기본 운동 + 내가 만든 운동, 숨기기 (5차 목업 v2 설정)
import { useState } from 'react'
import { FilterBar, NewExerciseSheet, EQUIPS, PARTS, useExerciseFilter } from '../components/ExercisePicker'
import { BackButton, Sheet } from '../components/ui'
import { upsert, useStore } from '../lib/store'
import type { BodyPart, Equipment, Exercise } from '../lib/types'

export default function ExerciseManage() {
  const { apply } = useStore()
  const f = useExerciseFilter(true)
  const [editing, setEditing] = useState<Exercise | null>(null)
  const [creating, setCreating] = useState(false)
  const toggleHidden = (e: Exercise) => apply([upsert('exercises', [{ ...e, hidden: !e.hidden }])])

  return (
    <>
      <BackButton to="/settings" label="설정" />
      <h1>운동 목록</h1>
      <FilterBar f={f} />
      <section className="card" style={{ gap: 0 }}>
        <h2 style={{ marginBottom: 4 }}>{f.results.length}개</h2>
        {f.results.map((e) => (
          <div key={e.id} className="list-item" style={{ opacity: e.hidden ? 0.55 : 1 }}>
            <span className="grow">
              <span className="strong" style={{ display: 'block' }}>
                {e.name}
              </span>
              <span className="muted">
                {e.body_part} · {e.kind === 'run' ? '거리·시간' : e.equipment}
                {e.is_custom ? ' · 내가 만든 운동' : ''}
              </span>
            </span>
            {e.is_custom && (
              <button type="button" className="chip" onClick={() => setEditing(e)}>
                고치기
              </button>
            )}
            <button type="button" className={'chip' + (e.hidden ? '' : ' on')} aria-pressed={!e.hidden} onClick={() => toggleHidden(e)}>
              {e.hidden ? '숨김' : '보임'}
            </button>
          </div>
        ))}
        <button type="button" className="list-item" onClick={() => setCreating(true)}>
          <span className="accent-text strong">+ 새 운동 만들기</span>
        </button>
      </section>
      {creating && <NewExerciseSheet initialName={f.q.trim()} onClose={() => setCreating(false)} onCreated={() => setCreating(false)} />}
      {editing && <EditSheet ex={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function EditSheet({ ex, onClose }: { ex: Exercise; onClose: () => void }) {
  const { apply } = useStore()
  const [name, setName] = useState(ex.name)
  const [part, setPart] = useState<BodyPart>(ex.body_part)
  const [equip, setEquip] = useState<Equipment>(ex.equipment)
  return (
    <Sheet title="내가 만든 운동 고치기" onClose={onClose}>
      <label className="field-label">
        <span className="muted">운동 이름</span>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="chips">
        {PARTS.filter((p) => p !== '유산소').map((p) => (
          <button key={p} type="button" className={'chip' + (part === p ? ' on' : '')} aria-pressed={part === p} onClick={() => setPart(p)}>
            {p}
          </button>
        ))}
      </div>
      <div className="chips">
        {EQUIPS.map((e) => (
          <button key={e} type="button" className={'chip' + (equip === e ? ' on' : '')} aria-pressed={equip === e} onClick={() => setEquip(e)}>
            {e}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-primary"
        disabled={!name.trim()}
        onClick={() => {
          apply([upsert('exercises', [{ ...ex, name: name.trim(), body_part: part, equipment: equip }])])
          onClose()
        }}
      >
        저장
      </button>
    </Sheet>
  )
}
