import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// mode 'demo' = 검수판 (체험판 기록, # 방식 주소, 어느 주소에 올려도 열리게 상대 경로)
export default defineConfig(({ mode }) => ({
  base: mode === 'demo' ? './' : '/',
  plugins: [react()],
}))
