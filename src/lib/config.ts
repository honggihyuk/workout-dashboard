// 어느 저장소를 쓸지: Supabase 주소·키가 있으면 실제 서버, 없거나 VITE_DATA_MODE=demo면 체험판
export const supabaseConfigured = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY
export const isDemo = import.meta.env.VITE_DATA_MODE === 'demo' || !supabaseConfigured
