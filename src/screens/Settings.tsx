// 설정: 목록 관리 (3차 1-2). 알림·엑셀 내려받기는 추가 구축에서 붙입니다 (docs/06-build.md 1-2)
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import { Sheet } from '../components/ui'
import { resetDemo } from '../lib/data/localRepo'
import { newId } from '../lib/ids'
import { supplementNutritionText as nutritionLabel } from '../lib/nutrition'
import { upsert, useStore } from '../lib/store'
import type { Supplement } from '../lib/types'
import { limits, num, rangeError } from '../lib/validate'

function kindLabel(s: Supplement) {
  if (s.schedule === 'daily') return '매일'
  return s.optional_on_run_only ? '운동하는 날 · 러닝만 한 날 선택' : '운동하는 날'
}

export default function Settings() {
  const { db, index, repo } = useStore()
  const [editing, setEditing] = useState<Supplement | 'new' | null>(null)
  const [resetting, setResetting] = useState(false)
  const all = [...db.supplements.values()].sort((a, b) => a.sort_order - b.sort_order)
  const customCount = index.exercises.filter((e) => e.is_custom).length
  const hiddenCount = index.exercises.filter((e) => e.hidden).length

  return (
    <>
      <h1>설정</h1>

      <h2 className="section-title">운동</h2>
      <div className="card" style={{ gap: 0, padding: '4px 16px' }}>
        <Link to="/workout/routines" className="list-item" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="grow strong">내 루틴</span>
          <span className="muted">{index.routines.length}개 · 편집</span>
          <Icon name="right" />
        </Link>
        <Link to="/settings/exercises" className="list-item" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="grow strong">운동 목록</span>
          <span className="muted">
            {index.exercises.length}개 · 내가 만든 운동 {customCount}개{hiddenCount ? ` · 숨김 ${hiddenCount}개` : ''}
          </span>
          <Icon name="right" />
        </Link>
      </div>
      <p className="muted">자주 하지 않는 운동은 목록에서 숨길 수 있어요.</p>

      <h2 className="section-title">영양제·보충제</h2>
      <div className="card" style={{ gap: 0, padding: '4px 16px' }}>
        {all.map((s) => (
          <button key={s.id} type="button" className="list-item" onClick={() => setEditing(s)} style={{ opacity: s.hidden ? 0.55 : 1 }}>
            <span className="grow">
              <span className="strong" style={{ display: 'block' }}>
                {s.name}
              </span>
              <span className="muted">
                {kindLabel(s)}
                {nutritionLabel(s) && ` · 식단에 더함 ${nutritionLabel(s)}`}
                {s.hidden ? ' · 숨김' : ''}
              </span>
            </span>
            <Icon name="right" />
          </button>
        ))}
        <button type="button" className="list-item" onClick={() => setEditing('new')}>
          <span className="accent-text strong">+ 추가</span>
        </button>
      </div>

      <h2 className="section-title">계정</h2>
      <div className="card">
        {repo.mode === 'demo' ? (
          <>
            <div className="row between">
              <span className="strong">체험판</span>
              <span className="badge badge-muted">이 기기에만 저장</span>
            </div>
            <p className="muted">예시 기록이 들어 있는 검수용 화면이에요. 여기서 적은 기록은 이 기기에만 남고, 실제 서버를 연결하면 따로 시작해요.</p>
            <button type="button" className="btn btn-ghost" onClick={() => setResetting(true)}>
              체험 기록 처음으로
            </button>
          </>
        ) : (
          <>
            <div className="row between">
              <span className="strong">구글 계정</span>
              <span className="muted">연결됨</span>
            </div>
            <button type="button" className="btn btn-quiet btn-danger" onClick={() => void import('../lib/auth').then((m) => m.signOut())}>
              로그아웃
            </button>
          </>
        )}
      </div>
      <p className="muted center">알림과 엑셀 내려받기는 배포 뒤 추가 구축에서 생겨요.</p>

      {editing && <SupplementSheet item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {resetting && (
        <Sheet title="체험 기록을 처음으로 되돌릴까요?" onClose={() => setResetting(false)}>
          <p className="muted">이 기기에서 적어 본 체험 기록이 지워지고 예시 기록으로 다시 시작해요.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              void resetDemo().then(() => window.location.reload())
            }}
          >
            처음으로 되돌리기
          </button>
        </Sheet>
      )}
    </>
  )
}

function SupplementSheet({ item, onClose }: { item: Supplement | null; onClose: () => void }) {
  const { db, apply } = useStore()
  const [name, setName] = useState(item?.name ?? '')
  const [short, setShort] = useState(item?.short_name ?? '')
  const [schedule, setSchedule] = useState<Supplement['schedule']>(item?.schedule ?? 'daily')
  const [optional, setOptional] = useState(item?.optional_on_run_only ?? false)
  const [hidden, setHidden] = useState(item?.hidden ?? false)
  const str = (v: number | null | undefined) => (v == null ? '' : String(v))
  const [serving, setServing] = useState(str(item?.serving_g))
  const [protein, setProtein] = useState(str(item?.protein_g))
  const [kcal, setKcal] = useState(str(item?.kcal))
  const [error, setError] = useState<string | null>(null)
  const save = () => {
    const g = num(serving)
    const p = num(protein)
    const k = num(kcal)
    const e =
      rangeError('1회 양', g, limits.supplementServing, { unit: 'g' }) ??
      rangeError('단백질', p, limits.mealProtein, { unit: 'g' }) ??
      rangeError('칼로리', k, limits.mealKcal, { unit: 'kcal' })
    if (e) return setError(e)
    const sort = item?.sort_order ?? Math.max(0, ...[...db.supplements.values()].map((s) => s.sort_order)) + 1
    apply([
      upsert('supplements', [
        {
          id: item?.id ?? newId(),
          name: name.trim(),
          short_name: short.trim() || null,
          schedule,
          optional_on_run_only: schedule === 'workout' && optional,
          sort_order: sort,
          hidden,
          serving_g: g,
          protein_g: p,
          kcal: k,
        },
      ]),
    ])
    onClose()
  }
  return (
    <Sheet title={item ? '영양제·보충제 수정' : '영양제·보충제 추가'} onClose={onClose}>
      <label className="field-label">
        <span className="muted">이름</span>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field-label">
        <span className="muted">짧은 이름 (체크 버튼에 표시, 선택)</span>
        <input className="field" placeholder="예: 칼슘 외 4종" value={short} onChange={(e) => setShort(e.target.value)} />
      </label>
      <div className="stack-sm">
        <span className="muted">언제 먹나요</span>
        <div className="seg" role="group" aria-label="언제 먹나요">
          <button type="button" className={schedule === 'daily' ? 'on' : ''} aria-pressed={schedule === 'daily'} onClick={() => setSchedule('daily')}>
            매일
          </button>
          <button type="button" className={schedule === 'workout' ? 'on' : ''} aria-pressed={schedule === 'workout'} onClick={() => setSchedule('workout')}>
            운동하는 날
          </button>
        </div>
      </div>
      {schedule === 'workout' && (
        <label className="row">
          <input type="checkbox" checked={optional} onChange={(e) => setOptional(e.target.checked)} style={{ width: 22, height: 22 }} />
          <span>러닝만 한 날은 선택 (안 먹어도 루틴 완료)</span>
        </label>
      )}
      <div className="stack-sm">
        <span className="strong small">식단에 더하기 (선택)</span>
        <div className="grid3">
          {(
            [
              ['1회 양 (g)', serving, setServing, '40'],
              ['단백질 (g)', protein, setProtein, '36'],
              ['칼로리 (kcal)', kcal, setKcal, '150'],
            ] as const
          ).map(([label, value, set, ph]) => (
            <label key={label} className="field-label">
              <span className="muted">{label}</span>
              <input className="field num" inputMode="decimal" placeholder={ph} value={value} onChange={(e) => set(e.target.value)} />
            </label>
          ))}
        </div>
        <span className="muted">먹은 날 단백질·칼로리 합계에 더해져요. 제품 영양표의 1회 양 기준으로 적어 주세요.</span>
      </div>
      {error && <p className="error">{error}</p>}
      {item && (
        <label className="row">
          <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} style={{ width: 22, height: 22 }} />
          <span>숨기기 (지금은 먹지 않음, 지난 기록은 남음)</span>
        </label>
      )}
      <button type="button" className="btn btn-primary" disabled={!name.trim()} onClick={save}>
        저장
      </button>
    </Sheet>
  )
}
