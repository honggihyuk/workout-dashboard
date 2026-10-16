// 오늘: 남은 할 일을 한눈에 보고 바로 체크하기 (3차 2장, 3-1, 5차 목업)
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { NutritionSummary } from '../components/Nutrition'
import { Check, ScoreRow, useDateParam } from '../components/ui'
import { longLabel, shortLabel } from '../lib/dates'
import {
  ALL_SLOTS,
  daySummary,
  dayOf,
  dayStatus,
  runText,
  fmtNum,
  mealFilled,
  requiredWorkoutSupplements,
  routineRotation,
  slotLabel,
  weeklyKpi,
} from '../lib/domain'
import { ids } from '../lib/ids'
import { dayNutrition } from '../lib/nutrition'
import { remove, upsert, useStore } from '../lib/store'
import type { Condition, Supplement } from '../lib/types'

export default function Today() {
  const date = useDateParam()
  const { index, todayDate } = useStore()
  const navigate = useNavigate()
  const status = dayStatus(index, date, todayDate)
  const isToday = date === todayDate

  return (
    <>
      <div className="row between">
        <button
          type="button"
          className="back"
          style={{ color: 'var(--text)', fontSize: '1.5rem', fontWeight: 800, minHeight: 44 }}
          onClick={() => navigate(`/calendar?date=${date}`)}
          aria-label={`${longLabel(date)}, 눌러서 달력 열기`}
        >
          {longLabel(date)}
          <Icon name="down" size={18} width={2.4} />
        </button>
        {status.state === 'done' ? (
          <span className="badge badge-good">{isToday ? '오늘 루틴 완료' : '루틴 완료'}</span>
        ) : status.state !== 'future' ? (
          <span className="muted">남은 항목 {status.missing.length}개</span>
        ) : null}
      </div>
      {!isToday && (
        <Link to="/today" className="btn-link small" style={{ marginTop: -8 }}>
          오늘로 돌아가기
        </Link>
      )}

      <WeekCard date={date} />

      <h2 className="section-title">{isToday ? '오늘 루틴' : '이날 루틴'}</h2>
      <MorningCard date={date} />
      <MealsCard date={date} />
      <SupplementCard date={date} kind="daily" />
      <SupplementCard date={date} kind="workout" />
      <WorkoutCard date={date} />
      <PostWorkoutCard date={date} />
    </>
  )
}

function WeekCard({ date }: { date: string }) {
  const { index } = useStore()
  const kpi = weeklyKpi(index, date)
  if (!kpi.hasAnyRecord)
    return (
      <section className="card" aria-label="이번 주">
        <h2>이번 주</h2>
        <p className="muted">기록이 쌓이면 여기에 이번 주 요약이 보입니다.</p>
      </section>
    )
  const ib = kpi.inbody
  return (
    <section className="card" aria-label="이번 주">
      <div className="row between">
        <h2>이번 주</h2>
        <span className="muted">
          {shortLabel(kpi.weekStart)} – {shortLabel(kpi.weekEnd)}
        </span>
      </div>
      <div className="grid2">
        <div className="stack-sm">
          <span className="muted">운동</span>
          <span className="big-num">
            {kpi.workoutCount}
            <span className="unit"> / {kpi.workoutGoal}회</span>
          </span>
          <div className="ticks" aria-hidden="true">
            {Array.from({ length: Math.max(kpi.workoutGoal, kpi.workoutCount) }, (_, i) => (
              <div key={i} className={'tick' + (i < kpi.workoutCount ? ' on' : '')} />
            ))}
          </div>
        </div>
        <div className="stack-sm">
          <span className="muted">식사 사진</span>
          <span className="big-num">
            {kpi.mealCount}
            <span className="unit"> / {kpi.mealGoal}끼</span>
          </span>
          <div className="meter" aria-hidden="true">
            <div style={{ width: `${Math.min(100, (kpi.mealCount / kpi.mealGoal) * 100)}%` }} />
          </div>
        </div>
      </div>
      <div className="row between divider">
        <span>
          인바디 {ib && <span className="muted">{shortLabel(ib.latest.date)}</span>}
        </span>
        {!ib ? (
          <span className="muted">기록 없음</span>
        ) : !ib.prev ? (
          <span className="muted">비교할 기록이 아직 없음</span>
        ) : (
          <span className="row-sm">
            <span className={'badge ' + (ib.muscle === 'good' ? 'badge-good' : 'badge-warn')}>골격근량 {ib.muscle === 'good' ? '좋음' : '주의'}</span>
            <span className={'badge ' + (ib.fat === 'good' ? 'badge-good' : 'badge-warn')}>체지방률 {ib.fat === 'good' ? '좋음' : '주의'}</span>
          </span>
        )}
      </div>
    </section>
  )
}

function ConditionCard({
  date,
  type,
  title,
  rows,
}: {
  date: string
  type: Condition['type']
  title: string
  rows: [key: 'fatigue' | 'sleep_quality' | 'intensity' | 'focus', label: string, hint: string][]
}) {
  const { index, apply } = useStore()
  const d = dayOf(index, date)
  const rec = type === 'morning' ? d.morning : d.post
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, number | null>>({})
  const value = (k: string) => (k in draft ? draft[k] : ((rec?.[k as keyof Condition] as number | null | undefined) ?? null))

  const pick = (k: string, n: number) => {
    const next = { ...draft, [k]: n }
    setDraft(next)
    const vals = Object.fromEntries(rows.map(([key]) => [key, key === k ? n : value(key)]))
    if (rows.every(([key]) => vals[key] != null)) {
      apply([
        upsert('conditions', [
          {
            id: type === 'morning' ? ids.morning(date) : ids.postWorkout(date),
            date,
            type,
            fatigue: null,
            sleep_quality: null,
            intensity: null,
            focus: null,
            ...vals,
          },
        ]),
      ])
      setEditing(false)
      setDraft({})
    }
  }

  const done = !!rec
  return (
    <div className="card">
      <div className="row">
        <Check done={done} />
        <div className="grow">
          <div className="strong">{title}</div>
          {done && !editing && <div className="muted">{rows.map(([k, label]) => `${label} ${rec[k] ?? '-'}`).join(' · ')}</div>}
        </div>
        {done && !editing && (
          <button type="button" className="chip" onClick={() => setEditing(true)}>
            수정
          </button>
        )}
      </div>
      {(!done || editing) && (
        <div className="stack indent">
          {rows.map(([k, label, hint]) => (
            <ScoreRow key={k} label={label} hint={hint} value={value(k)} onChange={(n) => pick(k, n)} />
          ))}
        </div>
      )}
    </div>
  )
}

function MorningCard({ date }: { date: string }) {
  return (
    <ConditionCard
      date={date}
      type="morning"
      title="아침 컨디션"
      rows={[
        ['fatigue', '피로도', '1 개운함 · 5 매우 피곤'],
        ['sleep_quality', '수면 질', '1 나쁨 · 5 아주 좋음'],
      ]}
    />
  )
}

function MealsCard({ date }: { date: string }) {
  const { index } = useStore()
  const d = dayOf(index, date)
  const main = ['breakfast', 'lunch', 'dinner'] as const
  const done = main.every((s) => mealFilled(d.meals[s]))
  return (
    <div className="card">
      <div className="row">
        <Check done={done} />
        <span className="grow strong">식사 사진</span>
        <Link to={`/meals?date=${date}`} className="btn-link small">
          식단으로
        </Link>
      </div>
      <div className="chips indent">
        {ALL_SLOTS.filter((s) => s !== 'snack' || d.meals.snack).map((s) => {
          const on = mealFilled(d.meals[s])
          return (
            <Link key={s} to={`/meals?date=${date}&slot=${s}`} className={'chip' + (on ? ' on' : '')} style={{ textDecoration: 'none' }} aria-label={`${slotLabel[s]} ${on ? '기록함' : '미기록'}`}>
              {on && <Icon name="check" size={14} width={3} />}
              {slotLabel[s]}
            </Link>
          )
        })}
      </div>
      <NutritionSummary date={date} />
    </div>
  )
}

function supplementChipLabel(s: Supplement) {
  return s.short_name || s.name
}

function SupplementCard({ date, kind }: { date: string; kind: 'daily' | 'workout' }) {
  const { index, apply, todayDate } = useStore()
  const d = dayOf(index, date)
  const status = dayStatus(index, date, todayDate)
  const list = index.supplements.filter((s) => s.schedule === kind)
  if (!list.length) return null
  const taken = list.filter((s) => d.logs.has(s.id)).length
  const required = kind === 'daily' ? list : requiredWorkoutSupplements(list, status.isRunOnly)
  const allRequired = required.every((s) => d.logs.has(s.id))
  const done = kind === 'daily' ? allRequired : status.isWorkoutDay ? allRequired : false

  const takenAt = () => (date === todayDate ? new Date().toISOString() : `${date}T12:00:00+09:00`)
  const toggle = (s: Supplement) => {
    const id = ids.supplementLog(date, s.id)
    if (d.logs.has(s.id)) apply([remove('supplement_logs', [id])])
    else apply([upsert('supplement_logs', [{ id, date, supplement_id: s.id, taken_at: takenAt() }])])
  }
  const takeAll = () =>
    apply([
      upsert(
        'supplement_logs',
        list.filter((s) => !d.logs.has(s.id)).map((s) => ({ id: ids.supplementLog(date, s.id), date, supplement_id: s.id, taken_at: takenAt() })),
      ),
    ])

  return (
    <div className="card">
      <div className="row">
        <Check done={done} />
        <span className="grow strong">
          {kind === 'daily' ? '영양제' : '보충제·쉐이크'}{' '}
          <span className="muted">
            {kind === 'daily' ? '매일' : status.isRunOnly ? '러닝한 날 · 쉐이크는 선택' : '운동하는 날'} · {taken} / {list.length}
          </span>
        </span>
      </div>
      <div className="chips indent">
        {list.map((s) => {
          const on = d.logs.has(s.id)
          const optional = kind === 'workout' && status.isRunOnly && s.optional_on_run_only
          return (
            <button
              key={s.id}
              type="button"
              className={'chip' + (on ? ' on' : '') + (optional && !on ? ' optional' : '')}
              aria-pressed={on}
              onClick={() => toggle(s)}
            >
              {supplementChipLabel(s)}
              {optional && !on && <span className="muted"> 선택</span>}
            </button>
          )
        })}
      </div>
      {kind === 'daily' && taken < list.length && (
        <button type="button" className="btn btn-ghost" style={{ marginLeft: 38 }} onClick={takeAll}>
          매일 영양제 모두 먹음
        </button>
      )}
      {kind === 'workout' && !status.isWorkoutDay && <p className="muted indent">운동을 기록한 날만 루틴에 반영돼요</p>}
    </div>
  )
}

function WorkoutCard({ date }: { date: string }) {
  const { index, db, todayDate } = useStore()
  const summary = daySummary(index, db, date)
  const { next } = routineRotation(index, db)
  if (!summary)
    return (
      <div className="card">
        <div className="row">
          <Check done={false} />
          <span className="grow strong">운동</span>
          {next && date === todayDate && <span className="muted">다음 차례: {next.name}</span>}
        </div>
        <Link className="btn btn-primary" to={date === todayDate ? '/workout' : `/workout/log?date=${date}`}>
          운동 기록하기
        </Link>
      </div>
    )
  const parts: string[] = []
  if (summary.setCount) parts.push(`${summary.exerciseCount}종목 · ${summary.setCount}세트 · 볼륨 ${fmtNum(summary.volume, 0)}kg`)
  for (const r of summary.runs) parts.push(`러닝 ${runText(r)}`)
  const burned = dayNutrition(index, date).exercise
  if (burned && burned.total > 0) parts.push(`운동으로 약 ${fmtNum(burned.total, 0)}kcal 사용`)
  return (
    <div className="card">
      <div className="row">
        <Check done />
        <div className="grow">
          <div className="strong">운동 {summary.routineName && <span className="muted">{summary.routineName}</span>}</div>
          {parts.map((p) => (
            <div key={p} className="muted">
              {p}
            </div>
          ))}
        </div>
        <Link to={`/workout/log?date=${date}`} className="chip" style={{ textDecoration: 'none' }}>
          수정
        </Link>
      </div>
    </div>
  )
}

function PostWorkoutCard({ date }: { date: string }) {
  const { index, todayDate } = useStore()
  const status = dayStatus(index, date, todayDate)
  if (!status.isWorkoutDay)
    return (
      <div className="card">
        <div className="row">
          <Check done={false} />
          <div className="grow">
            <div className="strong">운동 후 컨디션</div>
            <div className="muted">운동을 기록하면 체크할 수 있어요</div>
          </div>
        </div>
      </div>
    )
  return (
    <ConditionCard
      date={date}
      type="post_workout"
      title="운동 후 컨디션"
      rows={[
        ['intensity', '운동 강도 느낌', '1 가벼움 · 5 매우 힘듦'],
        ['focus', '집중도', '1 낮음 · 5 높음'],
      ]}
    />
  )
}
