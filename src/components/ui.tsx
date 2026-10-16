// 여러 화면이 함께 쓰는 작은 부품
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Icon from './Icon'
import { isValidDate } from '../lib/dates'
import { useStore } from '../lib/store'

export function Check({ done, label }: { done: boolean; label?: string }) {
  return (
    <span className={'check' + (done ? ' done' : '')} role="img" aria-label={label ?? (done ? '완료' : '남음')}>
      {done && <Icon name="check" size={15} width={3.2} />}
    </span>
  )
}

export function ScoreRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: number | null
  onChange: (n: number) => void
}) {
  return (
    <div className="stack-sm" role="group" aria-label={label}>
      <div className="row between">
        <span className="strong small">{label}</span>
        <span className="muted">{hint}</span>
      </div>
      <div className="scores">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" className={'score' + (value === n ? ' on' : '')} aria-pressed={value === n} onClick={() => onChange(n)}>
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="닫기" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function BackButton({ to, label }: { to?: string; label: string }) {
  const navigate = useNavigate()
  return (
    <button type="button" className="back" onClick={() => (to ? navigate(to) : navigate(-1))}>
      <Icon name="left" size={20} />
      {label}
    </button>
  )
}

/** 주소의 ?date= 값. 없거나 잘못되면 오늘 */
export function useDateParam(): string {
  const [params] = useSearchParams()
  const { todayDate } = useStore()
  const d = params.get('date')
  return isValidDate(d) ? d : todayDate
}

/** 사진 주소 (비공개 저장소라 그때그때 받아 옴) */
export function Photo({ path, alt, className = 'photo' }: { path: string; alt: string; className?: string }) {
  const { repo } = useStore()
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void repo.photoUrl(path).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [repo, path])
  return url ? <img className={className} src={url} alt={alt} /> : <div className={className} role="img" aria-label={alt} />
}

// "맞나요?" 확인 (4차 5장 데이터 오류). 브라우저 기본 확인 창 대신 화면 안에서 묻습니다.
type Ask = (title: string, lines: string[]) => Promise<boolean>
const ConfirmContext = createContext<Ask>(async () => true)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<{ title: string; lines: string[]; resolve: (ok: boolean) => void } | null>(null)
  const ask = useCallback<Ask>((title, lines) => new Promise((resolve) => setReq({ title, lines, resolve })), [])
  const close = (ok: boolean) => {
    req?.resolve(ok)
    setReq(null)
  }
  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {req && (
        <Sheet title={req.title} onClose={() => close(false)}>
          <ul className="stack-sm" style={{ margin: 0, paddingLeft: 18 }}>
            {req.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <button type="button" className="btn btn-primary" onClick={() => close(true)}>
            맞아요, 저장
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => close(false)}>
            다시 볼게요
          </button>
        </Sheet>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): Ask {
  return useContext(ConfirmContext)
}

export function SyncBanner() {
  const { pending, syncError, retry, repo } = useStore()
  if (!pending || repo.mode === 'demo') return null
  return (
    <div className="banner" role="status">
      <span>저장 대기 {pending}건{syncError ? ' · 연결되면 자동으로 보내요' : ''}</span>
      <button type="button" className="btn btn-link" onClick={retry}>
        다시 보내기
      </button>
    </div>
  )
}
