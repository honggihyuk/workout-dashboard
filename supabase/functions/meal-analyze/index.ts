// 식사 사진 AI 분석 (docs/04-system-design.md 2-4, 4-1)
// 화면이 올린 사진 경로를 받아 Gemini에 보내고, 메뉴·칼로리·단백질 추정을 돌려줍니다.
// 저장은 화면이 합니다 (사진을 올린 직후 식사 기록이 아직 서버에 없을 수 있어서).
//
// Supabase 대시보드 → Edge Functions → 새 함수(이름 meal-analyze)에 이 파일을 그대로 붙여 넣어 배포합니다.
// 필요한 비밀값 (Edge Functions → Secrets):
//   GEMINI_API_KEY  Google AI Studio에서 만든 키 (필수, 저장소에 넣지 않음)
//   GEMINI_MODEL    쓸 모델 이름 (선택, 없으면 아래 DEFAULT_MODEL)
// SUPABASE_URL과 공개 키는 Supabase가 자동으로 넣어 줍니다.
// 다른 파일을 불러오지 않는 한 파일입니다 (대시보드에 붙여 넣기 쉽게).

/** 2026-10 기준 무료 등급에서 새 프로젝트에 권장되는 Flash 모델 */
export const DEFAULT_MODEL = 'gemini-3.8-flash'
/** Gemini 응답 제한 시간 */
const TIMEOUT_MS = 30_000
const BUCKET = 'meal-photos'
/** 화면이 만드는 사진 경로: 2026-10-16/m_2026-10-16_lunch-abc123.jpg */
export const PHOTO_PATH = /^\d{4}-\d{2}-\d{2}\/[\w.-]+\.jpg$/

export const PROMPT = `이 사진 속 음식을 보고 한 끼 전체를 추정해 주세요.
- menu: 메뉴 이름을 한국어로 짧게 (예: "닭가슴살 샐러드", "김치찌개, 밥"). 여러 음식이면 쉼표로 잇습니다.
- kcal: 사진에 보이는 양 전부의 총 칼로리 (kcal)
- protein_g: 사진에 보이는 양 전부의 단백질 (g)
- confidence: 추정에 대한 확신 (high, medium, low)
- is_food: 음식 사진이 아니면 false
그릇 크기와 담긴 양을 보고 실제로 먹는 양을 기준으로 추정합니다.`

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    menu: { type: 'STRING' },
    kcal: { type: 'NUMBER' },
    protein_g: { type: 'NUMBER' },
    confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
    is_food: { type: 'BOOLEAN' },
  },
  required: ['menu', 'kcal', 'protein_g', 'confidence', 'is_food'],
}

export interface MealEstimate {
  menu: string
  kcal: number
  protein_g: number
  confidence: 'high' | 'medium' | 'low'
}

export type AnswerCheck = { ok: true; value: MealEstimate } | { ok: false; code: 'not_food' | 'bad_answer' }

/** Gemini가 돌려준 글을 검사: JSON이 아니거나 kcal 0~5000, 단백질 0~300 밖이면 실패 */
export function parseAnswer(text: string): AnswerCheck {
  let v: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, code: 'bad_answer' }
    v = parsed as Record<string, unknown>
  } catch {
    return { ok: false, code: 'bad_answer' }
  }
  if (v.is_food === false) return { ok: false, code: 'not_food' }
  const menu = typeof v.menu === 'string' ? v.menu.trim().replace(/\s+/g, ' ') : ''
  const kcal = v.kcal
  const protein = v.protein_g
  if (!menu || menu.length > 200) return { ok: false, code: 'bad_answer' }
  if (typeof kcal !== 'number' || !Number.isFinite(kcal) || kcal < 0 || kcal > 5000) return { ok: false, code: 'bad_answer' }
  if (typeof protein !== 'number' || !Number.isFinite(protein) || protein < 0 || protein > 300) return { ok: false, code: 'bad_answer' }
  const confidence = v.confidence === 'high' || v.confidence === 'medium' ? v.confidence : 'low'
  return { ok: true, value: { menu, kcal: Math.round(kcal), protein_g: Math.round(protein * 10) / 10, confidence } }
}

/** Gemini 응답에서 답 글만 꺼내기 (생각 과정 부분은 뺌) */
export function answerText(data: unknown): string | null {
  const parts = (data as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] })?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return null
  const text = parts
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('')
  return text || null
}

/** 사진 바이트 → base64 (큰 배열도 한 번에 넘기지 않게 나눠서) */
export function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

type Env = { get(name: string): string | undefined }

function publicKey(env: Env): string | undefined {
  const legacy = env.get('SUPABASE_ANON_KEY')
  if (legacy) return legacy
  try {
    const keys = JSON.parse(env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}') as Record<string, string>
    return keys.default ?? Object.values(keys)[0]
  } catch {
    return undefined
  }
}

function corsHeaders(req: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': req.headers.get('Access-Control-Request-Headers') ?? 'authorization, x-client-info, apikey, content-type',
  }
}

export async function handle(req: Request, env: Env): Promise<Response> {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return reply(405, { error: 'method' })

  const url = env.get('SUPABASE_URL')
  const apikey = publicKey(env)
  const geminiKey = env.get('GEMINI_API_KEY')
  const model = env.get('GEMINI_MODEL')?.trim() || DEFAULT_MODEL
  if (!url || !apikey || !geminiKey) {
    console.error('meal-analyze: 설정값 없음', { url: !!url, apikey: !!apikey, geminiKey: !!geminiKey })
    return reply(500, { error: 'not_configured' })
  }

  // 대표님 계정인지 확인 (로그인 토큰으로 is_allowed 함수 호출)
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return reply(401, { error: 'unauthorized' })
  const asUser = { apikey, Authorization: auth }
  const allowed = await fetch(`${url}/rest/v1/rpc/is_allowed`, { method: 'POST', headers: { ...asUser, 'Content-Type': 'application/json' }, body: '{}' })
  if (!allowed.ok || (await allowed.json().catch(() => false)) !== true) return reply(403, { error: 'forbidden' })

  let path: unknown
  try {
    path = ((await req.json()) as { photo_path?: unknown }).photo_path
  } catch {
    return reply(400, { error: 'bad_request' })
  }
  if (typeof path !== 'string' || !PHOTO_PATH.test(path)) return reply(400, { error: 'bad_request' })

  const photo = await fetch(`${url}/storage/v1/object/authenticated/${BUCKET}/${path}`, { headers: asUser })
  if (!photo.ok) return reply(404, { error: 'photo_not_found' })
  const bytes = new Uint8Array(await photo.arrayBuffer())

  let res: Response
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: toBase64(bytes) } }, { text: PROMPT }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
          // Gemini 3 계열은 생각 단계를 짧게 해서 빨리 답하게 함
          ...(model.startsWith('gemini-3') ? { thinkingConfig: { thinkingLevel: 'low' } } : {}),
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    const timeout = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')
    console.error('meal-analyze: Gemini 연결 실패', String(e))
    return reply(timeout ? 504 : 502, { error: timeout ? 'timeout' : 'ai_error' })
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('meal-analyze: Gemini 오류', res.status, detail.slice(0, 500))
    if (res.status === 429) return reply(429, { error: 'rate_limit' })
    if (res.status === 401 || res.status === 403 || (res.status === 400 && /API key/i.test(detail))) return reply(500, { error: 'bad_key' })
    if (res.status === 404) return reply(500, { error: 'bad_model' })
    return reply(502, { error: 'ai_error' })
  }

  const text = answerText(await res.json().catch(() => null))
  const check = text ? parseAnswer(text) : ({ ok: false, code: 'bad_answer' } as const)
  if (!check.ok) {
    console.error('meal-analyze: 답 형식 오류', check.code, text?.slice(0, 300))
    return reply(422, { error: check.code })
  }
  return reply(200, { ...check.value, model })
}

// Supabase에서 실행될 때만 서버를 띄움 (시험할 때는 위 함수만 불러 씀)
declare const Deno: { serve(handler: (req: Request) => Response | Promise<Response>): unknown; env: Env } | undefined
if (typeof Deno !== 'undefined') Deno.serve((req) => handle(req, Deno!.env))
