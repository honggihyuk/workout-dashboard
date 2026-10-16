// 단백질 표 화면: 고기·생선 등 100g당 단백질과 무게별 계산 (6차 검수 요청)
import { FoodCalculator } from '../components/FoodTable'
import { BackButton } from '../components/ui'

export default function Foods() {
  return (
    <>
      <BackButton to="/meals" label="식단" />
      <div className="stack-sm">
        <h1>단백질 표</h1>
        <span className="muted">음식을 누르고 먹은 무게를 넣으면 단백질과 칼로리를 계산해요.</span>
      </div>
      <FoodCalculator />
    </>
  )
}
