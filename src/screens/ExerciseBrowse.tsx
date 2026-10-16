// 운동별 기록 보기: 운동을 하나 고르면 최근 5회 흐름으로 이동
import { useNavigate } from 'react-router-dom'
import ExercisePicker from '../components/ExercisePicker'

export default function ExerciseBrowse() {
  const navigate = useNavigate()
  return (
    <ExercisePicker
      multiple={false}
      title="운동별 기록 보기"
      onCancel={() => navigate('/workout')}
      onDone={([id]) => navigate(`/workout/exercise/${encodeURIComponent(id)}`, { replace: true })}
    />
  )
}
