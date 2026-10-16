// 운동별 기록: 지난번 기록, 최근 5회 볼륨 막대와 세트 목록 (3차 3-2, U5)
// 러닝: 이번 달 합계, 최고 기록, 최근 5회 거리와 페이스 (6차 검수 요청)
import { Link, useParams } from 'react-router-dom'
import { VolumeBars } from '../components/charts'
import { BackButton } from '../components/ui'
import { monthStart, shortLabel } from '../lib/dates'
import { allRuns, fmtDuration, fmtKg, fmtNum, fmtPaceSec, isRunRoutine, paceOf, recentSessions, runBests, runText, runTotals, setsText } from '../lib/domain'
import { RUN_EXERCISE_ID } from '../lib/seed'
import { runKcal, weightOn } from '../lib/nutrition'
import { useStore } from '../lib/store'
import type { ReactNode } from 'react'

export default function ExerciseDetail() {
  const { id = '' } = useParams()
  const { db, index, todayDate } = useStore()
  const ex = db.exercises.get(id)

  if (!ex)
    return (
      <>
        <BackButton to="/workout" label="운동" />
        <p className="muted">운동을 찾을 수 없어요.</p>
      </>
    )

  const header = (
    <>
      <div className="row between">
        <BackButton label="뒤로" />
        <Link to="/workout/exercises" className="chip" style={{ textDecoration: 'none' }}>
          다른 운동 보기
        </Link>
      </div>
      <div className="stack-sm">
        <h1>{ex.name}</h1>
        <span className="muted">
          {ex.body_part} · {ex.kind === 'run' ? '거리·평균 페이스' : ex.equipment}
        </span>
      </div>
    </>
  )

  if (id === RUN_EXERCISE_ID) return <RunDetail header={header} />

  const sessions = recentSessions(index, id, 5, todayDate)
  const last = sessions[sessions.length - 1]
  const top = last?.sets.reduce((a, s) => (s.weight_kg > a.weight_kg || (s.weight_kg === a.weight_kg && s.reps > a.reps) ? s : a), last.sets[0])
  return (
    <>
      {header}
      {!last ? (
        <p className="card muted">첫 기록입니다. 기록하면 여기에 최근 흐름이 보여요.</p>
      ) : (
        <>
          <section className="card" aria-label="지난번 기록">
            <span className="muted">지난번 · {shortLabel(last.date)}</span>
            <span className="big-num">
              {fmtKg(top.weight_kg)}
              <span className="unit">kg × {top.reps}회</span>
            </span>
            <span className="muted">
              {last.sets.length}세트 · 볼륨 {fmtNum(last.volume, 0)}kg
            </span>
          </section>
          <section className="card" aria-label="최근 5회 흐름">
            <div className="row between">
              <h2>최근 {sessions.length}회 흐름</h2>
              <span className="muted">볼륨 (kg)</span>
            </div>
            <VolumeBars label={`${ex.name} 최근 볼륨`} items={sessions.map((s) => ({ date: s.date, value: s.volume }))} />
            {[...sessions].reverse().map((s) => (
              <div key={s.date} className="row small" style={{ alignItems: 'flex-start' }}>
                <span className="muted" style={{ width: '2.8rem', flex: 'none' }}>
                  {shortLabel(s.date)}
                </span>
                <span>{setsText(s.sets)}</span>
              </div>
            ))}
          </section>
        </>
      )}
      <Link to={`/workout/log?add=${encodeURIComponent(id)}`} className="btn btn-primary">
        오늘 기록에 추가
      </Link>
    </>
  )
}

function RunDetail({ header }: { header: ReactNode }) {
  const { index, todayDate } = useStore()
  const runs = allRuns(index, todayDate)
  const recent = runs.slice(-5)
  const monthRuns = runs.filter((r) => r.date >= monthStart(todayDate))
  const month = runTotals(monthRuns)
  const monthKcal = monthRuns.reduce((a, r) => {
    const kg = weightOn(index, r.date)
    return kg == null ? a : a + runKcal(r, kg)
  }, 0)
  const { longest, fastest } = runBests(runs)
  const runRoutine = index.routines.find(isRunRoutine)
  return (
    <>
      {header}
      {!runs.length ? (
        <p className="card muted">첫 기록입니다. 운동 기록에서 러닝을 추가해 보세요.</p>
      ) : (
        <>
          <section className="card" aria-label="이번 달 러닝">
            <span className="muted">이번 달 · {month.count}회</span>
            <span className="big-num">
              {fmtNum(month.km, 2)}
              <span className="unit">km</span>
            </span>
            <div className="run-stats">
              <div>
                <span className="muted">평균 페이스</span>
                <span className="v">{fmtPaceSec(month.pace, false) || '–'}</span>
              </div>
              <div>
                <span className="muted">총 시간</span>
                <span className="v">{month.durationSec ? fmtDuration(month.durationSec) : '–'}</span>
              </div>
              <div>
                <span className="muted">활동 칼로리</span>
                <span className="v">{monthKcal ? `${fmtNum(monthKcal, 0)}kcal` : '–'}</span>
              </div>
            </div>
          </section>
          <section className="card" aria-label="최고 기록">
            <h2>최고 기록</h2>
            {longest && (
              <div className="row between small">
                <span>가장 긴 거리</span>
                <span>
                  <span className="strong">{fmtNum(longest.distance_km, 2)}km</span> <span className="muted">{shortLabel(longest.date)}</span>
                </span>
              </div>
            )}
            {fastest && (
              <div className="row between small">
                <span>가장 빠른 평균 페이스</span>
                <span>
                  <span className="strong">{fmtPaceSec(paceOf(fastest))}</span> <span className="muted">{shortLabel(fastest.date)}</span>
                </span>
              </div>
            )}
          </section>
          <section className="card" aria-label="최근 5회 흐름">
            <div className="row between">
              <h2>최근 {recent.length}회 흐름</h2>
              <span className="muted">거리 (km)</span>
            </div>
            <VolumeBars label="러닝 거리" unit="km" digits={1} items={recent.map((r) => ({ date: r.date, value: r.distance_km }))} />
            {[...recent].reverse().map((r) => (
              <div key={r.id} className="row between small">
                <span className="muted">{shortLabel(r.date)}</span>
                <span>{runText(r)}</span>
              </div>
            ))}
          </section>
        </>
      )}
      <Link to={runRoutine ? `/workout/log?routine=${runRoutine.id}` : `/workout/log?add=${RUN_EXERCISE_ID}`} className="btn btn-primary">
        오늘 러닝 기록하기
      </Link>
    </>
  )
}
