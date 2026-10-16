// 단백질 표: 음식별 100g당 단백질·칼로리, 무게를 넣으면 계산 (6차 검수 요청)
// onAdd가 있으면 식사 입력에서 열린 것: 계산한 값을 그 끼니에 더합니다.
import { useState } from 'react'
import { fmtNum } from '../lib/domain'
import { FOOD_GROUPS, FOODS, foodAmount, per100, type Food, type FoodGroup, type WeightBasis } from '../lib/foods'
import { local } from '../lib/storage'
import { num } from '../lib/validate'

export interface FoodPick {
  name: string
  grams: number
  protein: number
  kcal: number
}

const BASIS_KEY = 'wcc.food.basis'

export function FoodCalculator({ onAdd }: { onAdd?: (pick: FoodPick) => void }) {
  const [basis, setBasisState] = useState<WeightBasis>(() => (local.get(BASIS_KEY) === 'raw' ? 'raw' : 'cooked'))
  const [group, setGroup] = useState<FoodGroup | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [grams, setGrams] = useState('')
  const setBasis = (b: WeightBasis) => {
    setBasisState(b)
    local.set(BASIS_KEY, b)
  }
  const select = (f: Food) => {
    if (selected === f.id) return setSelected(null)
    setSelected(f.id)
    setGrams(String(f.serving?.g ?? 100))
  }
  const list = FOODS.filter((f) => !group || f.group === group)

  return (
    <div className="stack">
      <div className="seg" role="group" aria-label="무게 기준">
        {(
          [
            ['cooked', '익힌 무게'],
            ['raw', '생 무게'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" className={basis === k ? 'on' : ''} aria-pressed={basis === k} onClick={() => setBasis(k)}>
            {label}
          </button>
        ))}
      </div>
      <div className="chips" role="group" aria-label="음식 종류">
        <button type="button" className={'chip' + (group === null ? ' on' : '')} aria-pressed={group === null} onClick={() => setGroup(null)}>
          전체
        </button>
        {FOOD_GROUPS.map((g) => (
          <button key={g} type="button" className={'chip' + (group === g ? ' on' : '')} aria-pressed={group === g} onClick={() => setGroup(g)}>
            {g}
          </button>
        ))}
      </div>

      <div className="card" style={{ gap: 0, padding: '4px 16px' }}>
        <div className="row between muted small food-head" aria-hidden="true">
          <span>100g당</span>
          <span>단백질 · 칼로리</span>
        </div>
        {list.map((f) => {
          const v = per100(f, basis)
          const open = selected === f.id
          return (
            <div key={f.id} className="food-row">
              <button type="button" className="list-item" aria-expanded={open} onClick={() => select(f)}>
                <span className="grow">
                  <span className="strong" style={{ display: 'block' }}>
                    {f.name}
                  </span>
                  {!f.raw && <span className="muted">생·익힌 구분 없음</span>}
                </span>
                <span className="food-val">
                  <span className="strong">{fmtNum(v.protein)}g</span>
                  <span className="muted"> · {fmtNum(v.kcal, 0)}kcal</span>
                </span>
              </button>
              {open && <FoodAmount food={f} basis={basis} grams={grams} setGrams={setGrams} onAdd={onAdd} />}
            </div>
          )
        })}
      </div>
      <p className="muted">
        어림값이에요. 같은 부위도 기름기와 조리법에 따라 달라질 수 있고, 포장 제품은 영양표를 따라 주세요. 미국 농무부(USDA) 식품성분 자료와 국내 연구 자료를 바탕으로 했어요.
      </p>
    </div>
  )
}

function FoodAmount({
  food,
  basis,
  grams,
  setGrams,
  onAdd,
}: {
  food: Food
  basis: WeightBasis
  grams: string
  setGrams: (v: string) => void
  onAdd?: (pick: FoodPick) => void
}) {
  const g = num(grams)
  const ok = g != null && !Number.isNaN(g) && g > 0 && g <= 5000
  const amount = ok ? foodAmount(food, basis, g) : null
  return (
    <div className="food-amount">
      <label className="field-label">
        <span className="muted">
          먹은 양 ({basis === 'raw' && food.raw ? '생 무게' : '익힌 무게'}, g){food.serving && ` · ${food.serving.label} 약 ${food.serving.g}g`}
        </span>
        <input className="field num" inputMode="decimal" value={grams} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setGrams(e.target.value)} />
      </label>
      <div className="row between">
        <span>
          {amount ? (
            <>
              단백질 <span className="strong">{fmtNum(amount.protein)}g</span> · {fmtNum(amount.kcal, 0)}kcal
            </>
          ) : (
            <span className="muted">무게를 적어 주세요</span>
          )}
        </span>
        {onAdd && (
          <button
            type="button"
            className="btn btn-primary btn-small"
            disabled={!amount}
            onClick={() => amount && onAdd({ name: food.name.replace(/ \(.*\)$/, ''), grams: g!, protein: amount.protein, kcal: amount.kcal })}
          >
            이 끼니에 더하기
          </button>
        )}
      </div>
    </div>
  )
}
