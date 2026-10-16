/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'demo'면 체험판(기기 저장), 없으면 Supabase 설정이 있을 때 실제 서버 */
  readonly VITE_DATA_MODE?: string
  /** 'hash'면 주소에 #을 쓰는 방식 (검수판용) */
  readonly VITE_ROUTER?: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
