// 데이터 오류 범위표 시험 (4차 5장)
import { describe, expect, it } from 'vitest'
import { bigChangeAbs, bigChangeRatio, limits, num, rangeError } from './validate'

describe('입력값 검사', () => {
  it('빈 칸은 null, 쉼표 소수점 허용, 글자는 NaN', () => {
    expect(num('')).toBeNull()
    expect(num(' 72,5 ')).toBe(72.5)
    expect(Number.isNaN(num('abc'))).toBe(true)
  })

  it('막는 범위', () => {
    expect(rangeError('무게', 401, limits.weight)).not.toBeNull()
    expect(rangeError('무게', 0, limits.weight)).toBeNull()
    expect(rangeError('횟수', 0, limits.reps)).not.toBeNull()
    expect(rangeError('거리', 0, limits.runKm, { exclusiveMin: true })).not.toBeNull()
    expect(rangeError('체중', 29, limits.bodyWeight)).not.toBeNull()
    expect(rangeError('체지방률', 61, limits.bodyFatPct)).not.toBeNull()
    expect(rangeError('칼로리', 5001, limits.mealKcal)).not.toBeNull()
    expect(rangeError('무게', NaN, limits.weight)).toContain('숫자')
  })

  it('"맞나요?" 확인: 무게 30% 넘게, 체중 3kg 넘게', () => {
    expect(bigChangeRatio(100, 131, 0.3)).toBe(true)
    expect(bigChangeRatio(100, 130, 0.3)).toBe(false)
    expect(bigChangeRatio(undefined, 999, 0.3)).toBe(false)
    expect(bigChangeAbs(76, 79.5, 3)).toBe(true)
    expect(bigChangeAbs(76, 79, 3)).toBe(false)
  })
})
