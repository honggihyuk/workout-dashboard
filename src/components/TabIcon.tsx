// 탭 아이콘: 선으로 그린 아이콘 (docs/05-ui-design.md 3장 확정 테마)
import type { ReactNode } from 'react'

export type TabIconName = 'today' | 'workout' | 'meals' | 'body' | 'settings'

const paths: Record<TabIconName, ReactNode> = {
  today: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M8.5 12l2.5 2.5 4.5-5" />
    </>
  ),
  workout: <path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" />,
  meals: (
    <>
      <path d="M4 12h16a8 7 0 0 1-16 0z" />
      <path d="M9.5 4.5c-1 1.2 1 2 0 3.5M14.5 4.5c-1 1.2 1 2 0 3.5" />
    </>
  ),
  body: (
    <>
      <path d="M4 19h16" />
      <path d="M5.5 15l4-4.5 3.5 3 5.5-6.5" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
}

export default function TabIcon({ name }: { name: TabIconName }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
