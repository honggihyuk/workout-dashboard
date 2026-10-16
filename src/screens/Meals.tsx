// 식단: 끼니별 사진 올리기, 직접 입력(메뉴·양·칼로리·단백질), 메모, 오늘 먹은 양 (3차 3-3, U2·U9)
// 먹은 양 카드: 단백질 목표(체중 × 1.5~2g) 대비, 먹은 칼로리와 쓴 칼로리 비교 (6차 검수 요청)
// 사진을 올리면 AI가 메뉴·칼로리·단백질을 어림하고, 대표님이 "맞아요"나 "고치기"로 확인합니다 (6차 검수 및 안정화, docs/06-build.md 4장)
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import { NutritionCard } from '../components/Nutrition'
import { useToast } from '../components/Toast'
import { Photo, Sheet, useDateParam } from '../components/ui'
import { FoodCalculator, type FoodPick } from '../components/FoodTable'
import { longLabel, nowTime } from '../lib/dates'
import { ALL_SLOTS, dayOf, fmtNum, slotLabel } from '../lib/domain'
import { ids } from '../lib/ids'
import { addsToDiet, mealKcal, mealProtein, supplementNutritionText } from '../lib/nutrition'
import { AnalyzeError, photoPath, type AnalyzeErrorCode } from '../lib/data/repo'
import { shrinkPhoto } from '../lib/photo'
import { remove, upsert, useStore } from '../lib/store'
import type { Meal, MealSlot, MealStatus, Supplement } from '../lib/types'
import { limits, num, rangeError } from '../lib/validate'

function blankMeal(date: string, slot: MealSlot): Meal {
  return {
    id: ids.meal(date, slot),
    date,
    slot,
    eaten_at: null,
    photo_path: null,
    status: 'empty',
    ai_menu: null,
    ai_kcal: null,
    ai_protein_g: null,
    manual_menu: null,
    manual_g: null,
    manual_kcal: null,
    manual_protein_g: null,
    memo: null,
  }
}

const kcalOf = mealKcal
const proteinOf = mealProtein
const menuOf = (m: Meal) => m.manual_menu ?? m.ai_menu
/** 대표님이 직접 적은 값이 있는지 (있으면 사진을 바꿔도 AI 분석으로 덮지 않음) */
const hasManual = (m: Meal) => m.manual_kcal != null || m.manual_protein_g != null || !!m.manual_menu
/** 직접 적은 값을 다 지웠을 때: AI 추정이 있으면 확인 전으로 되돌림 */
const photoOnlyStatus = (m: Meal): MealStatus => (m.ai_kcal != null || m.ai_protein_g != null ? 'estimated' : m.status === 'failed' ? 'failed' : 'uploaded')

const AI_ERROR: Record<AnalyzeErrorCode, string> = {
  rate_limit: '오늘 AI 분석 무료 한도를 다 썼어요. 내일 다시 분석을 누르시거나, 지금은 직접 적어 주세요.',
  not_food: '음식 사진이 아닌 것 같아요. 다른 사진을 올리거나 직접 적어 주세요.',
  setup: 'AI 분석이 아직 연결되지 않았어요. 연결 안내서의 Gemini 단계를 확인해 주세요. 지금은 직접 적어 주세요.',
  offline: '인터넷에 연결되지 않아 분석하지 못했어요. 연결되면 다시 분석을 눌러 주세요.',
  failed: 'AI가 이 사진을 분석하지 못했어요. 다시 분석하거나 직접 적어 주세요.',
}

function valuesText(m: Meal): string {
  return [
    kcalOf(m) != null ? `${fmtNum(kcalOf(m)!, 0)} kcal` : null,
    proteinOf(m) != null ? `단백질 ${fmtNum(proteinOf(m)!, 0)}g` : null,
    m.manual_g != null ? `${fmtNum(m.manual_g, 0)}g` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export default function Meals() {
  const date = useDateParam()
  const [params] = useSearchParams()
  const { index, todayDate } = useStore()
  const d = dayOf(index, date)

  const slot = params.get('slot')
  useEffect(() => {
    if (slot) document.getElementById('meal-' + slot)?.scrollIntoView({ block: 'start' })
  }, [slot])

  return (
    <>
      <div className="stack-sm">
        <h1>식단</h1>
        <span className="muted">{longLabel(date)}</span>
        {date !== todayDate && (
          <Link to="/meals" className="btn-link small">
            오늘로 돌아가기
          </Link>
        )}
      </div>
      <NutritionCard date={date} />
      <DietSupplementsCard date={date} />
      <Link to="/meals/foods" className="card card-link">
        <div className="row">
          <Icon name="search" size={22} />
          <div className="grow">
            <div className="strong">단백질 표</div>
            <div className="muted">고기·생선·계란 100g당 단백질과 무게별 계산</div>
          </div>
          <Icon name="right" />
        </div>
      </Link>
      {ALL_SLOTS.map((s) => (
        <MealCard key={s} date={date} slot={s} meal={d.meals[s]} />
      ))}
    </>
  )
}

/** 식단에 더하는 쉐이크 등: 먹었으면 눌러 체크 (오늘 화면 보충제 체크와 같은 기록) */
function DietSupplementsCard({ date }: { date: string }) {
  const { index, apply, todayDate } = useStore()
  const d = dayOf(index, date)
  const list = index.supplements.filter(addsToDiet)
  if (!list.length) return null
  const toggle = (s: Supplement) => {
    const id = ids.supplementLog(date, s.id)
    if (d.logs.has(s.id)) apply([remove('supplement_logs', [id])])
    else apply([upsert('supplement_logs', [{ id, date, supplement_id: s.id, taken_at: date === todayDate ? new Date().toISOString() : `${date}T12:00:00+09:00` }])])
  }
  return (
    <section className="card" aria-label="쉐이크">
      {list.map((s) => {
        const on = d.logs.has(s.id)
        return (
          <div key={s.id} className="row">
            <div className="grow">
              <div className="strong">{s.name}</div>
              <div className="muted">{supplementNutritionText(s)}</div>
            </div>
            <button type="button" className={'chip' + (on ? ' on' : '')} aria-pressed={on} onClick={() => toggle(s)}>
              {on && <Icon name="check" size={14} width={3} />}
              {on ? '먹음' : '안 먹음'}
            </button>
          </div>
        )
      })}
      <span className="muted">
        먹은 날은 단백질·칼로리 합계에 더해져요. 양과 성분은{' '}
        <Link to="/settings" className="btn-link">
          설정
        </Link>
        에서 바꿀 수 있어요.
      </span>
    </section>
  )
}

function MealCard({ date, slot, meal }: { date: string; slot: MealSlot; meal?: Meal }) {
  const { apply, repo, todayDate } = useStore()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiError, setAiError] = useState<AnalyzeErrorCode | null>(null)
  const [lowConfidence, setLowConfidence] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  // 분석을 기다리는 사이에 바뀐 기록 위에 결과를 얹기 위해 가장 최근 기록을 들고 있음
  const mealRef = useRef(meal)
  mealRef.current = meal

  const analyze = async (path: string) => {
    setAnalyzing(true)
    setAiError(null)
    setLowConfidence(false)
    try {
      const est = await repo.analyzePhoto(path)
      const cur = mealRef.current
      // 기다리는 사이 사진을 바꿨거나 기록을 지웠으면 결과를 버림
      if (!cur || cur.photo_path !== path) return
      apply([
        upsert('meals', [
          { ...cur, ai_menu: est.menu, ai_kcal: est.kcal, ai_protein_g: est.protein_g, status: cur.status === 'confirmed' ? 'confirmed' : 'estimated' },
        ]),
      ])
      setLowConfidence(est.confidence === 'low')
    } catch (e) {
      const cur = mealRef.current
      if (!cur || cur.photo_path !== path) return
      setAiError(e instanceof AnalyzeError ? e.code : 'failed')
      // 실패하면 직접 입력 칸을 엶 (4차 2-4)
      if (cur.status !== 'confirmed') {
        apply([upsert('meals', [{ ...cur, status: 'failed' }])])
        setEditing(true)
      }
    } finally {
      setAnalyzing(false)
    }
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const blob = await shrinkPhoto(file)
      const base = meal ?? blankMeal(date, slot)
      const path = photoPath(date, `${base.id}-${Date.now().toString(36)}`)
      await repo.putPhoto(path, blob)
      // 직접 적은 값이 있으면 그대로 두고 사진만 바꿈. 아니면 새 사진으로 AI 분석
      const keep = base.status === 'confirmed' && hasManual(base)
      const next: Meal = {
        ...base,
        photo_path: path,
        status: keep ? 'confirmed' : 'uploaded',
        ai_menu: null,
        ai_kcal: null,
        ai_protein_g: null,
        eaten_at: base.eaten_at ?? (date === todayDate ? nowTime() : null),
      }
      apply([upsert('meals', [next])])
      if (meal?.photo_path) void repo.removePhoto(meal.photo_path)
      if (!keep) {
        mealRef.current = next
        setEditing(false)
        void analyze(path)
      }
    } catch (e) {
      setError('사진을 올리지 못했어요. 다시 시도해 주세요. ' + (e instanceof Error ? `(${e.message})` : ''))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const confirmAi = () => {
    if (!meal) return
    apply([upsert('meals', [{ ...meal, status: 'confirmed' }])])
    setLowConfidence(false)
  }

  const deleteMeal = () => {
    if (!meal) return
    let undone = false
    apply([remove('meals', [meal.id])])
    setEditing(false)
    toast(`${slotLabel[slot]} 기록을 지웠어요`, () => {
      undone = true
      apply([upsert('meals', [meal])])
    })
    // 되돌리기 시간이 지나면 사진도 지움
    if (meal.photo_path)
      window.setTimeout(() => {
        if (!undone) void repo.removePhoto(meal.photo_path!)
      }, 7000)
  }

  const status = meal?.status
  const badge = analyzing ? (
    <span className="badge badge-muted">분석 중</span>
  ) : !meal ? (
    <span className="muted">미기록{slot === 'snack' ? ' · 선택' : ''}</span>
  ) : status === 'confirmed' ? (
    <span className="badge badge-good">확인함</span>
  ) : status === 'estimated' ? (
    <span className="badge badge-warn">확인 필요</span>
  ) : status === 'failed' ? (
    <span className="badge badge-warn">분석 실패</span>
  ) : (
    <span className="badge badge-muted">사진만</span>
  )

  // 사진 고르기: 카메라·앨범 중 고르기 (U9, capture를 두지 않아 아이폰이 선택지를 보여 줌)
  const fileInput = (
    <input ref={fileRef} type="file" accept="image/*" className="sr" tabIndex={-1} onChange={(e) => void onFile(e.target.files?.[0])} />
  )
  const pickPhoto = () => fileRef.current?.click()
  const idle = !editing && !analyzing

  return (
    <section id={'meal-' + slot} className="card" aria-label={slotLabel[slot]} aria-busy={analyzing || uploading}>
      {fileInput}
      <div className="row between">
        <h2>
          {slotLabel[slot]} {meal?.eaten_at && <span className="muted">{meal.eaten_at}</span>}
        </h2>
        {badge}
      </div>
      {meal?.photo_path && <Photo path={meal.photo_path} alt={`${slotLabel[slot]} 사진`} />}
      {uploading && <p className="muted">사진을 줄여서 올리는 중…</p>}
      {analyzing && (
        <p className="muted ai-working" role="status">
          AI가 사진을 보고 메뉴와 칼로리를 어림하는 중…
        </p>
      )}
      {error && <p className="error">{error}</p>}

      {idle && meal && status === 'confirmed' && (
        <div className="row between" style={{ alignItems: 'flex-end' }}>
          <div className="stack-sm" style={{ gap: 2 }}>
            {menuOf(meal) && <span className="strong">{menuOf(meal)}</span>}
            <span className="small">{valuesText(meal)}</span>
            {!hasManual(meal) && meal.ai_kcal != null && <span className="muted">AI 추정을 확인함</span>}
            {meal.memo && <span className="muted">{meal.memo}</span>}
          </div>
          <button type="button" className="btn btn-link small" onClick={() => setEditing(true)}>
            수정 · 메모
          </button>
        </div>
      )}
      {idle && meal && status === 'estimated' && (
        <>
          <div className="ai-estimate">
            <span className="ai-label">AI 추정</span>
            <span className="strong">{menuOf(meal)}</span>
            <span className="small">{valuesText(meal)}</span>
          </div>
          <p className="muted">
            {lowConfidence ? 'AI도 확신이 낮은 사진이에요. 메뉴와 양을 한 번 봐 주세요.' : '사진으로 어림한 값이에요. 맞으면 눌러 주시고, 다르면 고쳐 주세요.'}
          </p>
          <div className="grid2">
            <button type="button" className="btn btn-primary" onClick={confirmAi}>
              맞아요
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}>
              고치기
            </button>
          </div>
        </>
      )}
      {idle && meal && status === 'failed' && (
        <>
          <p className="error">{AI_ERROR[aiError ?? 'failed']}</p>
          <div className="grid2">
            <button type="button" className="btn btn-ghost" disabled={!meal.photo_path} onClick={() => meal.photo_path && void analyze(meal.photo_path)}>
              다시 분석
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}>
              직접 적기
            </button>
          </div>
        </>
      )}
      {idle && meal && (status === 'uploaded' || status === 'empty') && (
        <>
          <p className="muted">{meal.photo_path ? '사진은 저장됐어요. AI 분석을 아직 하지 않았어요.' : '메뉴나 칼로리를 적어 주세요.'}</p>
          <div className="grid2">
            {meal.photo_path && (
              <button type="button" className="btn btn-ghost" onClick={() => void analyze(meal.photo_path!)}>
                AI로 분석
              </button>
            )}
            <button type="button" className="btn btn-quiet" onClick={() => setEditing(true)}>
              직접 적기
            </button>
          </div>
        </>
      )}
      {idle && !meal && (
        <div className="grid2">
          <button type="button" className="btn btn-ghost" disabled={uploading} onClick={pickPhoto}>
            <Icon name="camera" /> 사진 올리기
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => setEditing(true)}>
            사진 없이 적기
          </button>
        </div>
      )}
      {editing && aiError && status === 'failed' && <p className="error">{AI_ERROR[aiError]}</p>}
      {editing && (
        <MealForm
          date={date}
          slot={slot}
          meal={meal}
          onClose={() => setEditing(false)}
          onPickPhoto={pickPhoto}
          onDelete={meal ? deleteMeal : undefined}
        />
      )}
    </section>
  )
}

function MealForm({
  date,
  slot,
  meal,
  onClose,
  onPickPhoto,
  onDelete,
}: {
  date: string
  slot: MealSlot
  meal?: Meal
  onClose: () => void
  onPickPhoto: () => void
  onDelete?: () => void
}) {
  const { apply, todayDate } = useStore()
  const s = (n: number | null | undefined) => (n == null ? '' : String(n))
  const [f, setF] = useState({
    time: meal?.eaten_at ?? (date === todayDate ? nowTime() : ''),
    menu: meal ? (menuOf(meal) ?? '') : '',
    g: s(meal?.manual_g),
    kcal: s(meal ? kcalOf(meal) : null),
    protein: s(meal ? proteinOf(meal) : null),
    memo: meal?.memo ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const [foods, setFoods] = useState(false)
  const [added, setAdded] = useState<string | null>(null)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((cur) => ({ ...cur, [k]: e.target.value }))
  // 단백질 표에서 고른 음식을 이 끼니 칸에 더함 (이미 적힌 값에 더하기)
  const addFood = (p: FoodPick) => {
    const plus = (cur: string, v: number, digits: number) => String(Number(((num(cur) || 0) + v).toFixed(digits)))
    setF((cur) => ({
      ...cur,
      protein: plus(cur.protein, p.protein, 1),
      kcal: plus(cur.kcal, p.kcal, 0),
      g: plus(cur.g, p.grams, 0),
      menu: [cur.menu.trim(), `${p.name} ${fmtNum(p.grams, 0)}g`].filter(Boolean).join(', '),
    }))
    setAdded(`${p.name} ${fmtNum(p.grams, 0)}g: 단백질 ${fmtNum(p.protein)}g · ${fmtNum(p.kcal, 0)}kcal을 더했어요`)
    setFoods(false)
  }

  const save = () => {
    const g = num(f.g)
    const kcal = num(f.kcal)
    const protein = num(f.protein)
    const err =
      rangeError('양', g, limits.mealGram, { unit: 'g' }) ??
      rangeError('칼로리', kcal, limits.mealKcal, { unit: 'kcal' }) ??
      rangeError('단백질', protein, limits.mealProtein, { unit: 'g' })
    if (err) return setError(err)
    const menu = f.menu.trim() || null
    const hasContent = !!menu || g != null || kcal != null || protein != null
    if (!meal?.photo_path && !hasContent) return setError('사진을 올리거나 메뉴·칼로리 중 하나를 적어 주세요')
    const base = meal ?? blankMeal(date, slot)
    apply([
      upsert('meals', [
        {
          ...base,
          eaten_at: /^\d{2}:\d{2}$/.test(f.time) ? f.time : null,
          manual_menu: menu,
          manual_g: g,
          manual_kcal: kcal,
          manual_protein_g: protein,
          memo: f.memo.trim() || null,
          status: hasContent ? 'confirmed' : base.photo_path ? photoOnlyStatus(base) : 'empty',
        },
      ]),
    ])
    onClose()
  }

  return (
    <div className="stack">
      <div className="grid2">
        <label className="field-label">
          <span className="muted">시간</span>
          <input className="field" type="time" value={f.time} onChange={set('time')} />
        </label>
        <label className="field-label">
          <span className="muted">양 (g)</span>
          <input className="field" inputMode="numeric" placeholder="선택" value={f.g} onChange={set('g')} />
        </label>
        <label className="field-label">
          <span className="muted">칼로리 (kcal)</span>
          <input className="field" inputMode="numeric" placeholder="선택" value={f.kcal} onChange={set('kcal')} />
        </label>
        <label className="field-label">
          <span className="muted">단백질 (g)</span>
          <input className="field" inputMode="numeric" placeholder="선택" value={f.protein} onChange={set('protein')} />
        </label>
      </div>
      <button type="button" className="btn btn-ghost" onClick={() => setFoods(true)}>
        단백질 표에서 고기·생선 더하기
      </button>
      {added && <p className="muted">{added}</p>}
      <label className="field-label">
        <span className="muted">메뉴</span>
        <input className="field" placeholder="예: 연어 포케" value={f.menu} onChange={set('menu')} />
      </label>
      <label className="field-label">
        <span className="muted">메모</span>
        <input className="field" placeholder="선택" value={f.memo} onChange={set('memo')} />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="button" className="btn btn-primary" onClick={save}>
        저장
      </button>
      {foods && (
        <Sheet title="단백질 표" onClose={() => setFoods(false)}>
          <FoodCalculator onAdd={addFood} />
        </Sheet>
      )}
      <div className="row between">
        <button type="button" className="btn btn-quiet" onClick={onClose}>
          취소
        </button>
        <span className="row-sm">
          <button type="button" className="btn btn-quiet" onClick={onPickPhoto}>
            {meal?.photo_path ? '사진 바꾸기' : '사진 올리기'}
          </button>
          {onDelete && (
            <button type="button" className="btn btn-quiet btn-danger" onClick={onDelete}>
              지우기
            </button>
          )}
        </span>
      </div>
    </div>
  )
}
