// 운동 홈: 내 루틴으로 시작(다음 차례), 지난 운동 그대로, 운동 골라서 시작, 최근 운동 (5차 목업 v2)
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { longLabel, shortLabel } from '../lib/dates'
import {
  dayOf,
  daySummary,
  runText,
  fmtNum,
  lastSession,
  recentWorkoutDays,
  routineExercises,
  routineRotation,
  volumeOf,
  isRunRoutine,
  fmtPaceSec,
  lastRun,
  paceOf,
  runGoalMet,
  runTargetText,
  type DaySummary,
} from '../lib/domain'
import { dayNutrition } from '../lib/nutrition'
import { useStore } from '../lib/store'
import type { Routine } from '../lib/types'

function summaryLine(s: DaySummary) {
  const parts: string[] = []
  if (s.setCount) parts.push(`${s.exerciseCount}종목 · ${s.setCount}세트 · 볼륨 ${fmtNum(s.volume, 0)}kg`)
  for (const r of s.runs) parts.push(runText(r))
  return parts.join(' / ')
}

export default function Workout() {
  const { index, db, todayDate } = useStore()
  const navigate = useNavigate()
  const { list, next } = routineRotation(index, db)
  const todaySummary = daySummary(index, db, todayDate)
  const recent = recentWorkoutDays(index, db, 3, todayDate)
  // 다음 차례 → 나머지 헬스 루틴 → 러닝 루틴
  const rank = (r: Routine) => (r.id === next?.id ? 0 : isRunRoutine(r) ? 2 : 1)
  const ordered = [...list].sort((a, b) => rank(a.routine) - rank(b.routine))

  return (
    <>
      <div className="stack-sm">
        <h1>운동</h1>
        <span className="muted">{longLabel(todayDate)}</span>
      </div>

      {todaySummary && <TodayResult summary={todaySummary} />}

      <div className="section-title">
        <h2>{todaySummary ? '루틴 더 하기' : '내 루틴으로 시작'}</h2>
        <Link to="/workout/routines" className="btn-link small">
          루틴 편집
        </Link>
      </div>
      {!list.length && (
        <div className="card">
          <p className="muted">루틴이 없어요. 루틴을 만들면 순서대로 "다음 차례"가 정해져요.</p>
          <Link to="/workout/routines?new=1" className="btn btn-ghost">
            루틴 만들기
          </Link>
        </div>
      )}
      {ordered.map(({ routine, lastDate }) => {
        if (isRunRoutine(routine)) return <RunRoutineCard key={routine.id} routine={routine} lastDate={lastDate} />
        const items = routineExercises(db, routine.id)
        const isNext = next?.id === routine.id
        return (
          <button
            key={routine.id}
            type="button"
            className={'card routine-card' + (isNext && !todaySummary ? ' next' : '')}
            onClick={() => navigate(`/workout/log?routine=${routine.id}`)}
          >
            <div className="row between">
              <span className="strong" style={{ fontSize: '1.05rem' }}>
                {routine.name}
              </span>
              {isNext && <span className="badge badge-good">다음 차례</span>}
            </div>
            <span className="small">{items.map((it) => db.exercises.get(it.exercise_id)?.name ?? '').join(' · ') || '운동 없음'}</span>
            <span className="muted">
              {items.length}종목{lastDate ? ` · 마지막 ${shortLabel(lastDate)}` : ' · 아직 안 함'}
            </span>
          </button>
        )
      })}
      <div className="grid2">
        <button type="button" className="btn btn-ghost" disabled={!recent.length} onClick={() => navigate('/workout/log?repeat=last')}>
          지난 운동 그대로
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/workout/log?pick=1')}>
          운동 골라서 시작
        </button>
      </div>

      {recent.length > 0 && (
        <section className="card" aria-label="최근 운동" style={{ gap: 0 }}>
          <h2 style={{ marginBottom: 4 }}>최근 운동</h2>
          {recent.map((s) => (
            <Link key={s.date} to={`/workout/log?date=${s.date}`} className="list-item" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="muted" style={{ width: '2.8rem' }}>
                {shortLabel(s.date)}
              </span>
              <span className="grow">
                <span className="strong" style={{ display: 'block' }}>
                  {s.routineName ?? (s.setCount ? '운동' : '러닝')}
                </span>
                <span className="muted">{summaryLine(s)}</span>
              </span>
            </Link>
          ))}
        </section>
      )}

      <Link to="/workout/exercises" className="card card-link">
        <div className="row">
          <Icon name="chart" size={22} />
          <div className="grow">
            <div className="strong">운동별 기록 보기</div>
            <div className="muted">운동마다 최근 5회 흐름</div>
          </div>
          <Icon name="right" />
        </div>
      </Link>
    </>
  )
}

/** 러닝 루틴 카드: 목표와 마지막 러닝 */
function RunRoutineCard({ routine, lastDate }: { routine: Routine; lastDate: string | null }) {
  const { index } = useStore()
  const navigate = useNavigate()
  const last = lastDate ? index.days.get(lastDate)?.runs[0] : null
  return (
    <button type="button" className="card routine-card" onClick={() => navigate(`/workout/log?routine=${routine.id}`)}>
      <div className="row between">
        <span className="strong" style={{ fontSize: '1.05rem' }}>
          {routine.name}
        </span>
        <span className="badge badge-muted">러닝</span>
      </div>
      <span className="small">{runTargetText(routine)}</span>
      <span className="muted">{last ? `마지막 ${shortLabel(lastDate!)} · ${runText(last)}` : '아직 안 함'}</span>
    </button>
  )
}

/** 저장한 오늘 운동 요약과 지난번 대비 (3차 3-2 저장 완료) */
function TodayResult({ summary }: { summary: DaySummary }) {
  const { index, db, todayDate } = useStore()
  const d = dayOf(index, todayDate)
  const burned = dayNutrition(index, todayDate).exercise
  const byEx = new Map<string, typeof d.sets>()
  for (const s of d.sets) byEx.set(s.exercise_id, [...(byEx.get(s.exercise_id) ?? []), s])
  return (
    <section className="card" aria-label="오늘 운동">
      <div className="row between">
        <h2>오늘 운동 {summary.routineName && <span className="muted">{summary.routineName}</span>}</h2>
        <Link to={`/workout/log?date=${todayDate}`} className="chip" style={{ textDecoration: 'none' }}>
          수정
        </Link>
      </div>
      <span className="muted">
        {summaryLine(summary)}
        {burned && burned.total > 0 && ` · 약 ${fmtNum(burned.total, 0)}kcal 사용`}
      </span>
      <div className="stack-sm">
        {[...byEx].map(([exId, sets]) => {
          const vol = volumeOf(sets)
          const prev = lastSession(index, exId, todayDate)
          const diff = prev ? vol - prev.volume : null
          return (
            <div key={exId} className="row between small">
              <span>{db.exercises.get(exId)?.name ?? '운동'}</span>
              <span>
                {fmtNum(vol, 0)}kg{' '}
                {diff == null ? (
                  <span className="muted">첫 기록</span>
                ) : (
                  <span className={diff >= 0 ? 'accent-text strong' : 'muted'}>
                    {diff >= 0 ? '+' : '−'}
                    {fmtNum(Math.abs(diff), 0)}
                  </span>
                )}
              </span>
            </div>
          )
        })}
        {d.runs.map((r) => {
          const prev = lastRun(index, todayDate)
          const pace = paceOf(r)
          const prevPace = prev ? paceOf(prev) : null
          const diff = pace != null && prevPace != null ? Math.round(prevPace - pace) : null
          const goal = runGoalMet(r, d.workout?.routine_id ? db.routines.get(d.workout.routine_id) : null)
          return (
            <div key={r.id} className="row between small">
              <span>
                러닝 {fmtNum(r.distance_km, 2)}km {goal && <span className="badge badge-good">목표 달성</span>}
              </span>
              <span>
                {fmtPaceSec(pace) || '시간 없음'}{' '}
                {diff == null ? (
                  !prev && <span className="muted">첫 기록</span>
                ) : diff === 0 ? (
                  <span className="muted">지난번과 같음</span>
                ) : diff > 0 ? (
                  <span className="accent-text strong">{diff}초 빠름</span>
                ) : (
                  <span className="muted">{-diff}초 느림</span>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
