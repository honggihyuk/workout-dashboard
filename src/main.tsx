import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App'
import Boot from './Boot'
import { ToastProvider } from './components/Toast'
import { ConfirmProvider } from './components/ui'
import './styles.css'

// 검수판은 한 파일 주소 안에서 화면을 바꾸므로 # 방식 주소를 씁니다
const Router = import.meta.env.VITE_ROUTER === 'hash' ? HashRouter : BrowserRouter

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <ToastProvider>
        <ConfirmProvider>
          <Boot>
            <App />
          </Boot>
        </ConfirmProvider>
      </ToastProvider>
    </Router>
  </StrictMode>,
)
