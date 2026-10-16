// 선으로 그린 작은 아이콘 (탭 아이콘과 같은 모양 규칙)
import type { ReactNode } from 'react'

export type IconName =
  | 'check'
  | 'down'
  | 'left'
  | 'right'
  | 'up'
  | 'camera'
  | 'plus'
  | 'minus'
  | 'close'
  | 'trash'
  | 'more'
  | 'search'
  | 'chart'
  | 'swap'

const paths: Record<IconName, ReactNode> = {
  check: <path d="M5 12l5 5 9-10" />,
  down: <path d="M6 9l6 6 6-6" />,
  up: <path d="M6 15l6-6 6 6" />,
  left: <path d="M15 5l-7 7 7 7" />,
  right: <path d="M9 5l7 7-7 7" />,
  camera: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="19" cy="12" r="1.2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </>
  ),
  chart: (
    <>
      <path d="M4 19h16" />
      <path d="M7 16V11M12 16V6M17 16v-7" />
    </>
  ),
  swap: <path d="M7 7h12l-3-3M17 17H5l3 3" />,
}

export default function Icon({ name, size = 18, width = 2.2 }: { name: IconName; size?: number; width?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
