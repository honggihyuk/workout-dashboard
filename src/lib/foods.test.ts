import { describe, expect, it } from 'vitest'
import { FOODS, foodAmount, per100 } from './foods'

describe('단백질 표', () => {
  const breast = FOODS.find((f) => f.id === 'chicken_breast')!

  it('먹은 무게로 계산: 익힌 닭가슴살 150g은 단백질 46.5g', () => {
    expect(foodAmount(breast, 'cooked', 150)).toEqual({ protein: 46.5, kcal: 247.5 })
    expect(foodAmount(breast, 'raw', 100).protein).toBe(22.5)
  })

  it('생·익힌 구분이 없는 음식은 생 무게를 골라도 같은 값', () => {
    const egg = FOODS.find((f) => f.id === 'egg')!
    expect(per100(egg, 'raw')).toEqual(per100(egg, 'cooked'))
  })

  it('표 값 점검: id 중복 없음, 익히면 단백질 비율이 같거나 높음, 칼로리는 단백질 칼로리(1g당 4kcal) 이상', () => {
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length)
    for (const f of FOODS) {
      if (f.raw) expect(f.cooked.protein).toBeGreaterThanOrEqual(f.raw.protein)
      for (const v of [f.cooked, f.raw].filter(Boolean)) {
        expect(v!.protein).toBeGreaterThan(0)
        expect(v!.protein).toBeLessThan(40)
        expect(v!.kcal).toBeGreaterThanOrEqual(v!.protein * 4)
      }
    }
  })
})
