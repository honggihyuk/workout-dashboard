// 몸 변화: 린매스업이 잘 되고 있는지 판단하기 (3차 3-4). 기본 기간 1개월
import { useState } from 'react'
import { LineChart } from '../components/charts'
import Icon from '../components/Icon'
import { useToast } from '../components/Toast'
import { Sheet, useConfirm } from '../components/ui'
import { addMonths, isValidDate, longLabel, shortLabel } from '../lib/dates'
import { fmtNum, inbodyVerdict, inRange, lastBefore } from '../lib/domain'
import { ids } from '../lib/ids'
import { remove, upsert, useStore } from '../lib/store'
import type { InBody } from '../lib/types'
import { bigChangeAbs, limits, num, rangeError } from '../lib/validate'

const PERIODS = [1, 3, 6] as const

function signed(n: number, unit: string) {
  const s = fmtNum(Math.abs(n))
  return `${n > 0 ? '+' : n < 0 ? '−' : '±'}${s}${unit}`
}

export default function Body() {
  const { index, todayDate, ensureFrom } = useStore()
  const [months, setMonths] = useState<(typeof PERIODS)[number]>(1)
  const [sheet, setSheet] = useState<null | 'weight' | 'inbody'>(null)
  const [showWeights, setShowWeights] = useState(false)
  const from = addMonths(todayDate, -months)
  const verdict = inbodyVerdict(index, todayDate)
  const weights = inRange(index.weights, from, todayDate)
  const mornings = inRange(index.mornings, from, todayDate)
  const latestWeight = index.weights[index.weights.length - 1]

  const pick = (m: (typeof PERIODS)[number]) => {
    setMonths(m)
    void ensureFrom(addMonths(todayDate, -m))
  }

  return (
    <>
      <h1>몸 변화</h1>
      <div className="seg" role="group" aria-label="기간">
        {PERIODS.map((m) => (
          <button key={m} type="button" className={months === m ? 'on' : ''} aria-pressed={months === m} onClick={() => pick(m)}>
            {m}개월
          </button>
        ))}
      </div>

      <section className="card" aria-label="인바디">
        <div className="row between">
          <h2>인바디</h2>
          {verdict && <span className="muted">{shortLabel(verdict.latest.date)} 측정{verdict.prev ? ` · ${shortLabel(verdict.prev.date)} 대비` : ''}</span>}
        </div>
        {!verdict ? (
          <p className="muted">인바디 기록이 없어요. 한 달에 한 번 입력해 주세요.</p>
        ) : (
          <>
            <InbodyRow label="골격근량" value={verdict.latest.skeletal_muscle_kg} prev={verdict.prev?.skeletal_muscle_kg} unit="kg" verdict={verdict.muscle} />
            <InbodyRow label="체지방률" value={verdict.latest.body_fat_pct} prev={verdict.prev?.body_fat_pct} unit="%" diffUnit="%p" verdict={verdict.fat} />
            <InbodyRow label="체지방량" value={verdict.latest.body_fat_kg} prev={verdict.prev?.body_fat_kg} unit="kg" />
            <InbodyRow label="기초대사량" value={verdict.latest.bmr_kcal} prev={verdict.prev?.bmr_kcal} unit="kcal" digits={0} />
            {!verdict.prev && <p className="muted">비교할 기록이 아직 없음</p>}
          </>
        )}
        <button type="button" className="btn btn-ghost" onClick={() => setSheet('inbody')}>
          인바디 입력
        </button>
      </section>

      <section className="card" aria-label="체중">
        <div className="row between">
          <h2>체중</h2>
          <span className="muted">{latestWeight ? `최근 ${fmtNum(latestWeight.weight_kg)}kg · ${months}개월` : `${months}개월`}</span>
        </div>
        <LineChart
          label={`최근 ${months}개월 체중 추이`}
          unit="kg"
          from={from}
          to={todayDate}
          series={[{ name: '체중', color: 'var(--accent)', points: weights.map((w) => ({ date: w.date, value: w.weight_kg })) }]}
        />
        {weights.length > 0 && (
          <div className="row between muted">
            <span>{shortLabel(from)}</span>
            <span>
              {weights.length > 1 && `기간 변화 ${signed(weights[weights.length - 1].weight_kg - weights[0].weight_kg, 'kg')}`}
            </span>
            <span>오늘</span>
          </div>
        )}
        <div className="grid2">
          <button type="button" className="btn btn-ghost" onClick={() => setSheet('weight')}>
            체중 입력
          </button>
          <button type="button" className="btn btn-quiet" disabled={!weights.length} onClick={() => setShowWeights((v) => !v)}>
            {showWeights ? '목록 닫기' : '기록 고치기'}
          </button>
        </div>
        {showWeights && <WeightList from={from} />}
      </section>

      <section className="card" aria-label="컨디션 추이">
        <div className="row between">
          <h2>컨디션 추이</h2>
          <span className="muted">아침 기준 · 1~5점</span>
        </div>
        <LineChart
          label="아침 피로도와 수면 질 추이"
          from={from}
          to={todayDate}
          fixed={[1, 5]}
          series={[
            { name: '피로도', color: 'var(--warn)', points: mornings.filter((c) => c.fatigue != null).map((c) => ({ date: c.date, value: c.fatigue! })) },
            { name: '수면 질', color: 'var(--accent)', dashed: true, points: mornings.filter((c) => c.sleep_quality != null).map((c) => ({ date: c.date, value: c.sleep_quality! })) },
          ]}
        />
        <div className="legend muted">
          <span>
            <i style={{ background: 'var(--warn)' }} />
            피로도 (높을수록 피곤)
          </span>
          <span>
            <i style={{ background: 'var(--accent)' }} />
            수면 질
          </span>
        </div>
      </section>

      {sheet === 'weight' && <WeightSheet onClose={() => setSheet(null)} />}
      {sheet === 'inbody' && <InbodySheet onClose={() => setSheet(null)} />}
    </>
  )
}

function InbodyRow({
  label,
  value,
  prev,
  unit,
  diffUnit,
  verdict,
  digits = 1,
}: {
  label: string
  value: number | null
  prev?: number | null
  unit: string
  diffUnit?: string
  verdict?: 'good' | 'warn' | null
  digits?: number
}) {
  if (value == null) return null
  return (
    <div className="row between">
      <span className="muted" style={{ width: '5.5rem' }}>
        {label}
      </span>
      <span className="grow strong">
        {fmtNum(value, digits)}
        {unit}
        {prev != null && <span className="muted"> {signed(Number((value - prev).toFixed(digits)), diffUnit ?? unit)}</span>}
      </span>
      {verdict && <span className={'badge ' + (verdict === 'good' ? 'badge-good' : 'badge-warn')}>{verdict === 'good' ? '좋음' : '주의'}</span>}
    </div>
  )
}

function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { todayDate } = useStore()
  return (
    <label className="field-label">
      <span className="muted">날짜</span>
      <input className="field" type="date" max={todayDate} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function WeightSheet({ onClose }: { onClose: () => void }) {
  const { index, apply, todayDate } = useStore()
  const ask = useConfirm()
  const [date, setDate] = useState(todayDate)
  const [kg, setKg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const save = async () => {
    const v = num(kg)
    if (!isValidDate(date) || date > todayDate) return setError('날짜를 확인해 주세요')
    if (v == null) return setError('체중을 적어 주세요')
    const err = rangeError('체중', v, limits.bodyWeight, { unit: 'kg' })
    if (err) return setError(err)
    const prev = lastBefore(index.weights, date)
    if (bigChangeAbs(prev?.weight_kg, v, 3) && !(await ask('지난번과 많이 달라요. 맞나요?', [`체중 ${fmtNum(v)}kg (지난번 ${fmtNum(prev!.weight_kg)}kg)`]))) return
    apply([upsert('body_weights', [{ id: ids.bodyWeight(date), date, weight_kg: v }])])
    onClose()
  }
  return (
    <Sheet title="체중 입력" onClose={onClose}>
      <DateField value={date} onChange={setDate} />
      <label className="field-label">
        <span className="muted">체중 (kg)</span>
        <input className="field" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} autoFocus />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="button" className="btn btn-primary" onClick={() => void save()}>
        저장
      </button>
    </Sheet>
  )
}

function InbodySheet({ onClose }: { onClose: () => void }) {
  const { index, apply, todayDate } = useStore()
  const ask = useConfirm()
  const [date, setDate] = useState(todayDate)
  const [f, setF] = useState({ muscle: '', fatPct: '', fatKg: '', bmr: '' })
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((c) => ({ ...c, [k]: e.target.value }))
  const save = async () => {
    if (!isValidDate(date) || date > todayDate) return setError('날짜를 확인해 주세요')
    const muscle = num(f.muscle)
    const fatPct = num(f.fatPct)
    const fatKg = num(f.fatKg)
    const bmr = num(f.bmr)
    if (muscle == null || fatPct == null) return setError('골격근량과 체지방률은 꼭 적어 주세요')
    const err =
      rangeError('골격근량', muscle, limits.muscleKg, { unit: 'kg' }) ??
      rangeError('체지방률', fatPct, limits.bodyFatPct, { unit: '%' }) ??
      rangeError('체지방량', fatKg, limits.fatKg, { unit: 'kg' }) ??
      rangeError('기초대사량', bmr, limits.bmr, { unit: 'kcal' })
    if (err) return setError(err)
    const prev = lastBefore(index.inbody, date)
    if (bigChangeAbs(prev?.body_fat_pct, fatPct, 5) && !(await ask('지난번과 많이 달라요. 맞나요?', [`체지방률 ${fmtNum(fatPct)}% (지난번 ${fmtNum(prev!.body_fat_pct)}%)`]))) return
    const row: InBody = { id: ids.inbody(date), date, skeletal_muscle_kg: muscle, body_fat_pct: fatPct, body_fat_kg: fatKg, bmr_kcal: bmr }
    apply([upsert('inbody', [row])])
    onClose()
  }
  return (
    <Sheet title="인바디 입력" onClose={onClose}>
      <DateField value={date} onChange={setDate} />
      <div className="grid2">
        {(
          [
            ['muscle', '골격근량 (kg)'],
            ['fatPct', '체지방률 (%)'],
            ['fatKg', '체지방량 (kg)'],
            ['bmr', '기초대사량 (kcal)'],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="field-label">
            <span className="muted">{label}</span>
            <input className="field" inputMode="decimal" value={f[k]} onChange={set(k)} />
          </label>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <button type="button" className="btn btn-primary" onClick={() => void save()}>
        저장
      </button>
      <InbodyList />
    </Sheet>
  )
}

function InbodyList() {
  const { index, apply } = useStore()
  const toast = useToast()
  const list = [...index.inbody].reverse().slice(0, 6)
  if (!list.length) return null
  return (
    <div className="stack-sm">
      <span className="muted">지난 기록</span>
      {list.map((b) => (
        <div key={b.id} className="row between small">
          <span>{longLabel(b.date)}</span>
          <span className="muted">
            {fmtNum(b.skeletal_muscle_kg)}kg · {fmtNum(b.body_fat_pct)}%
          </span>
          <button
            type="button"
            className="icon-btn"
            aria-label={`${longLabel(b.date)} 인바디 기록 지우기`}
            onClick={() => {
              apply([remove('inbody', [b.id])])
              toast('인바디 기록을 지웠어요', () => apply([upsert('inbody', [b])]))
            }}
          >
            <Icon name="trash" />
          </button>
        </div>
      ))}
    </div>
  )
}

function WeightList({ from }: { from: string }) {
  const { index, apply, todayDate } = useStore()
  const toast = useToast()
  const list = inRange(index.weights, from, todayDate).reverse()
  return (
    <div className="stack-sm">
      {list.map((w) => (
        <div key={w.id} className="row between small">
          <span>{longLabel(w.date)}</span>
          <span className="strong">{fmtNum(w.weight_kg)}kg</span>
          <button
            type="button"
            className="icon-btn"
            aria-label={`${longLabel(w.date)} 체중 기록 지우기`}
            onClick={() => {
              apply([remove('body_weights', [w.id])])
              toast('체중 기록을 지웠어요', () => apply([upsert('body_weights', [w])]))
            }}
          >
            <Icon name="trash" />
          </button>
        </div>
      ))}
    </div>
  )
}
