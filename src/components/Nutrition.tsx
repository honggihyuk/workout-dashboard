// 단백질 목표 대비 먹은 양, 먹은 칼로리 대비 쓴 칼로리 (6차 MVP v1 검수 요청)
import { Link } from 'react-router-dom'
import { fmtNum } from '../lib/domain'
import { dayNutrition, PROTEIN_G_PER_KG, proteinGap, type DayNutrition } from '../lib/nutrition'
import { useStore } from '../lib/store'

const n0 = (v: number) => fmtNum(v, 0)

function proteinLine(n: DayNutrition): string {
  if (!n.protein) return ''
  const gap = proteinGap(n.intake.protein, n.protein)
  if (gap.state === 'under') return `목표까지 ${n0(gap.grams)}g 더`
  if (gap.state === 'over') return `목표보다 ${n0(gap.grams)}g 많이`
  return '목표 범위 안'
}

function balanceLine(intake: number, burn: number, soFar: boolean): string {
  const diff = intake - burn
  const lead = soFar ? '지금까지 ' : ''
  if (Math.abs(diff) < 50) return `${lead}쓴 만큼 먹었어요`
  return diff > 0 ? `${lead}쓴 것보다 ${n0(diff)}kcal 더 먹었어요` : `${lead}쓴 것보다 ${n0(-diff)}kcal 덜 먹었어요`
}

/** 식단 화면: 단백질 목표와 칼로리 비교 */
export function NutritionCard({ date }: { date: string }) {
  const { index, todayDate } = useStore()
  const n = dayNutrition(index, date)
  const dayWord = date === todayDate ? '오늘' : '이날'
  const missingNote = n.intake.missing > 0 && (
    <span className="muted">숫자를 적지 않은 끼니 {n.intake.missing}개는 합계에서 빠져 있어요.</span>
  )
  const estimatedNote = n.intake.estimated > 0 && (
    <span className="muted">아직 확인하지 않은 AI 추정 {n.intake.estimated}끼가 들어 있어요. 아래 끼니에서 맞는지 봐 주세요.</span>
  )

  return (
    <section className="card" aria-label={`${dayWord} 단백질과 칼로리`}>
      <div className="row between">
        <h2>{dayWord} 먹은 양</h2>
        <span className="muted">
          끼니 {n.intake.counted}개{n.intake.extras.length > 0 && ` + ${n.intake.extras.map((s) => s.short_name || s.name).join(', ')}`}
        </span>
      </div>

      <div className="stack-sm">
        <div className="row between">
          <span className="strong">단백질</span>
          <span>
            <span className="strong">{n0(n.intake.protein)}g</span>
            {n.protein && (
              <span className="muted">
                {' '}
                / 목표 {n0(n.protein.min)}~{n0(n.protein.max)}g
              </span>
            )}
          </span>
        </div>
        {n.protein ? (
          <>
            <ProteinMeter eaten={n.intake.protein} target={n.protein} />
            <span className="muted">
              <span className={proteinGap(n.intake.protein, n.protein).state === 'under' ? 'strong text-ink' : 'accent-text strong'}>{proteinLine(n)}</span> · 체중{' '}
              {fmtNum(n.weightKg!)}kg × {PROTEIN_G_PER_KG.min}~{PROTEIN_G_PER_KG.max}g
            </span>
          </>
        ) : (
          <span className="muted">
            <Link to="/body" className="btn-link">
              체중을 적으면
            </Link>{' '}
            단백질 목표(체중 × {PROTEIN_G_PER_KG.min}~{PROTEIN_G_PER_KG.max}g)가 나와요.
          </span>
        )}
      </div>

      <hr className="rule" />

      <div className="stack-sm">
        <span className="strong">칼로리</span>
        {n.burn ? (
          <>
            <EnergyBars intake={n.intake.kcal} burn={n.burn.total} />
            <span className="strong text-ink">{balanceLine(n.intake.kcal, n.burn.total, date === todayDate)}</span>
            <span className="muted">
              쓴 칼로리 = 기초대사량 {n0(n.burn.bmr)}
              {n.burn.bmrFromInbody ? '(인바디)' : '(체중으로 어림)'} + 일상 활동 {n0(n.burn.daily)} + 운동 {n0(n.burn.exercise)}
              {n.exercise && (n.exercise.sets > 0 || n.exercise.runKm > 0) && (
                <>
                  {' '}
                  ({[n.exercise.sets ? `헬스 ${n.exercise.sets}세트 ${n0(n.exercise.gym)}` : '', n.exercise.runKm ? `러닝 ${fmtNum(n.exercise.runKm, 2)}km ${n0(n.exercise.run)}` : '']
                    .filter(Boolean)
                    .join(', ')}
                  )
                </>
              )}
            </span>
          </>
        ) : (
          <span className="muted">
            <span className="strong text-ink">{n0(n.intake.kcal)}kcal</span> 먹었어요.{' '}
            <Link to="/body" className="btn-link">
              체중이나 인바디를 적으면
            </Link>{' '}
            쓴 칼로리와 비교할 수 있어요.
          </span>
        )}
        {estimatedNote}
        {missingNote}
      </div>
    </section>
  )
}

/** 오늘 화면 식사 카드 안의 두 줄 요약 */
export function NutritionSummary({ date }: { date: string }) {
  const { index } = useStore()
  const n = dayNutrition(index, date)
  return (
    <Link to={`/meals?date=${date}`} className="nutrition-summary">
      <span>
        단백질 <span className="strong">{n0(n.intake.protein)}g</span>
        {n.protein && <span className="muted"> · {proteinLine(n)}</span>}
      </span>
      <span>
        칼로리 먹은 <span className="strong">{n0(n.intake.kcal)}</span>
        {n.burn && (
          <>
            {' '}
            · 쓴 <span className="strong">{n0(n.burn.total)}</span>
          </>
        )}
      </span>
    </Link>
  )
}

/** 목표 범위(띠) 위에 먹은 양(막대) */
function ProteinMeter({ eaten, target }: { eaten: number; target: { min: number; max: number } }) {
  const scale = Math.max(target.max * 1.15, eaten * 1.05)
  const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`
  return (
    <div className="bullet" aria-hidden="true">
      <div className="bullet-zone" style={{ left: pct(target.min), width: `calc(${pct(target.max)} - ${pct(target.min)})` }} />
      <div className="bullet-bar" style={{ width: pct(eaten) }} />
    </div>
  )
}

/** 먹은 칼로리와 쓴 칼로리를 같은 눈금에 */
function EnergyBars({ intake, burn }: { intake: number; burn: number }) {
  const scale = Math.max(intake, burn, 1)
  const rows: [string, number, string][] = [
    ['먹은', intake, 'energy-in'],
    ['쓴', burn, 'energy-out'],
  ]
  return (
    <div className="energy" aria-hidden="true">
      {rows.map(([label, v, cls]) => (
        <div key={label} className="energy-row">
          <span className="muted">{label}</span>
          <div className="energy-track">
            <div className={cls} style={{ width: `${Math.max(1, (v / scale) * 100)}%` }} />
          </div>
          <span className="strong energy-val">{n0(v)}</span>
        </div>
      ))}
    </div>
  )
}
