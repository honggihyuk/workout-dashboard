// 아래쪽 짧은 알림. 삭제는 확인 창 대신 몇 초간 "되돌리기"를 보여 줍니다 (U8).
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

interface ToastItem {
  id: number
  text: string
  undo?: () => void
}

const ToastContext = createContext<(text: string, undo?: () => void) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<ToastItem | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const show = useCallback((text: string, undo?: () => void) => {
    window.clearTimeout(timer.current)
    const id = Date.now()
    setItem({ id, text, undo })
    timer.current = window.setTimeout(() => setItem((cur) => (cur?.id === id ? null : cur)), undo ? 6000 : 3000)
  }, [])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return (
    <ToastContext.Provider value={show}>
      {children}
      {item && (
        <div className="toast" role="status">
          <span>{item.text}</span>
          {item.undo && (
            <button
              type="button"
              onClick={() => {
                item.undo?.()
                setItem(null)
              }}
            >
              되돌리기
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
