// 기록 id는 화면에서 만듭니다. 같은 저장을 두 번 보내도 한 건만 남습니다 (4차 5장 중복 실행).
// 하루에 한 건인 기록은 날짜로 id를 정해 두 번 생길 수 없게 합니다.
import type { MealSlot } from './types'

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

export const ids = {
  workout: (date: string) => `wo_${date}`,
  morning: (date: string) => `cm_${date}`,
  postWorkout: (date: string) => `cp_${date}`,
  bodyWeight: (date: string) => `bw_${date}`,
  inbody: (date: string) => `ib_${date}`,
  meal: (date: string, slot: MealSlot) => `ml_${date}_${slot}`,
  supplementLog: (date: string, supplementId: string) => `sl_${date}_${supplementId}`,
}
