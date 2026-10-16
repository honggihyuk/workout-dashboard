import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Today from './screens/Today'
import Calendar from './screens/Calendar'
import Workout from './screens/Workout'
import WorkoutLog from './screens/WorkoutLog'
import ExerciseBrowse from './screens/ExerciseBrowse'
import ExerciseDetail from './screens/ExerciseDetail'
import RoutineEdit from './screens/RoutineEdit'
import Meals from './screens/Meals'
import Foods from './screens/Foods'
import Body from './screens/Body'
import Settings from './screens/Settings'
import ExerciseManage from './screens/ExerciseManage'
import TabIcon, { type TabIconName } from './components/TabIcon'
import { SyncBanner } from './components/ui'

// 탭 5개 구성: docs/03-ux-ia-design.md 1-2장. 달력은 오늘 탭에 속함
const tabs: { to: string; label: string; icon: TabIconName; match: string[] }[] = [
  { to: '/today', label: '오늘', icon: 'today', match: ['/today', '/calendar'] },
  { to: '/workout', label: '운동', icon: 'workout', match: ['/workout'] },
  { to: '/meals', label: '식단', icon: 'meals', match: ['/meals'] },
  { to: '/body', label: '몸 변화', icon: 'body', match: ['/body'] },
  { to: '/settings', label: '설정', icon: 'settings', match: ['/settings'] },
]

export default function App() {
  const { pathname } = useLocation()
  return (
    <div className="app">
      <main className="screen">
        <SyncBanner />
        <Routes>
          {/* 앱 첫 화면은 항상 오늘 (U10) */}
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<Today />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/workout/log" element={<WorkoutLog />} />
          <Route path="/workout/exercises" element={<ExerciseBrowse />} />
          <Route path="/workout/exercise/:id" element={<ExerciseDetail />} />
          <Route path="/workout/routines" element={<RoutineEdit />} />
          <Route path="/meals" element={<Meals />} />
          <Route path="/meals/foods" element={<Foods />} />
          <Route path="/body" element={<Body />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/exercises" element={<ExerciseManage />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Routes>
      </main>
      <nav className="tabbar" aria-label="주요 메뉴">
        {tabs.map((tab) => {
          const active = tab.match.some((m) => pathname === m || pathname.startsWith(m + '/'))
          return (
            <Link key={tab.to} to={tab.to} className={'tab' + (active ? ' active' : '')} aria-current={active ? 'page' : undefined}>
              <TabIcon name={tab.icon} />
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
