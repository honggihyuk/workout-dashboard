// 달력: 루틴이 지켜진 패턴 보기, 빠진 기록 채우기 (3차 3-5)
import { useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import { BackButton } from '../components/ui'
import { addMonths, dateRange, isValidDate, longLabel, monthEnd, monthLabel, monthStart, weekday } from '../lib/dates'
import { dayStatus, type DayState } from '../lib/domain'
import { useStore } from '../lib/store'

const stateLabel: Record<DayState, string> = {
  done: '완료',
  missed: '놓친 항목 있음',
  empty: '기록 없음',
  in_progress: '진행 중',
  future: '',
}

export default function Calendar() {
  const { index, todayDate, ensureFrom } = useStore()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const picked = isValidDate(params.get('date')) ? params.get('date')! : todayDate
  const month = monthStart(isValidDate(params.get('month')) ? params.get('month')! : picked)

  useEffect(() => {
    void ensureFrom(month)
  }, [month, ensureFrom])

  const days = dateRange(month, monthEnd(month))
  const blanks = weekday(month)
  const sel = dayStatus(index, picked, todayDate)
  const go = (m: string) => setParams({ month: m, date: picked }, { replace: true })

  return (
    <>
      <BackButton to="/today" label="오늘" />
      <div className="row between">
        <button type="button" className="icon-btn" aria-label="이전 달" onClick={() => go(addMonths(month, -1))}>
          <Icon name="left" size={22} />
        </button>
        <h1>{monthLabel(month)}</h1>
        <button type="button" className="icon-btn" aria-label="다음 달" onClick={() => go(addMonths(month, 1))} disabled={month >= monthStart(todayDate)}>
          <Icon name="right" size={22} />
        </button>
      </div>

      <div className="card">
        <div className="cal">
          {['월', '화', '수', '목', '금', '토', '일'].map((w) => (
            <span key={w} className="cal-head">
              {w}
            </span>
          ))}
          {Array.from({ length: blanks }, (_, i) => (
            <span key={'b' + i} />
          ))}
          {days.map((d) => {
            const st = dayStatus(index, d, todayDate)
            const day = Number(d.slice(8))
            const cls = 'cell c-' + st.state + (d === picked ? ' sel' : '')
            if (st.state === 'future')
              return (
                <span key={d} className={cls}>
                  {day}
                </span>
              )
            return (
              <button
                key={d}
                type="button"
                className={cls}
                aria-label={`${longLabel(d)} ${stateLabel[st.state]}`}
                aria-pressed={d === picked}
                onClick={() => setParams({ month, date: d }, { replace: true })}
              >
                {day}
              </button>
            )
          })}
        </div>
        <div className="row wrap muted" style={{ gap: 12 }}>
          <span>
            <i className="swatch" style={{ background: 'var(--accent)' }} />
            완료
          </span>
          <span>
            <i className="swatch" style={{ background: 'var(--warn-soft)', boxShadow: 'inset 0 0 0 1px var(--warn)' }} />
            놓친 항목 있음
          </span>
          <span>
            <i className="swatch" style={{ boxShadow: 'inset 0 0 0 1px var(--unchecked)' }} />
            기록 없음
          </span>
          <span>
            <i className="swatch" style={{ boxShadow: 'inset 0 0 0 2px var(--accent)' }} />
            오늘
          </span>
        </div>
      </div>

      <section className="card" aria-live="polite">
        <div className="row between">
          <h2>{longLabel(picked)}</h2>
          <span className={sel.state === 'missed' ? 'badge badge-warn' : sel.state === 'done' ? 'badge badge-good' : 'muted'}>{stateLabel[sel.state]}</span>
        </div>
        {sel.missing.length > 0 && sel.state !== 'future' && (
          <>
            <div className="chips">
              {sel.missing.map((m) => (
                <span key={m} className="chip static">
                  {m}
                </span>
              ))}
            </div>
            <button type="button" className="btn btn-primary" onClick={() => navigate(`/today?date=${picked}`)}>
              {picked === todayDate ? '오늘 기록하기' : '빠진 기록 채우기'}
            </button>
          </>
        )}
        {sel.missing.length === 0 && (
          <Link to={`/today?date=${picked}`} className="btn-link">
            이날 기록 보기
          </Link>
        )}
      </section>
    </>
  )
}
