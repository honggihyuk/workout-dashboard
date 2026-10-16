// 식사 사진 AI 분석 서버 기능 시험 (Supabase·Gemini 응답은 흉내 냄)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { answerText, DEFAULT_MODEL, handle, parseAnswer, toBase64 } from '../meal-analyze/index'

describe('parseAnswer', () => {
  it('정상 답은 반올림해서 돌려줌', () => {
    expect(parseAnswer('{"menu":" 닭가슴살  샐러드 ","kcal":421.6,"protein_g":35.27,"confidence":"medium","is_food":true}')).toEqual({
      ok: true,
      value: { menu: '닭가슴살 샐러드', kcal: 422, protein_g: 35.3, confidence: 'medium' },
    })
  })
  it('확신 값이 이상하면 low', () => {
    const r = parseAnswer('{"menu":"김밥","kcal":480,"protein_g":12,"confidence":"?"}')
    expect(r.ok && r.value.confidence).toBe('low')
  })
  it('음식이 아니면 not_food', () => {
    expect(parseAnswer('{"menu":"고양이","kcal":0,"protein_g":0,"confidence":"high","is_food":false}')).toEqual({ ok: false, code: 'not_food' })
  })
  it('JSON이 아니거나 범위 밖이면 실패 (kcal 0~5000, 단백질 0~300)', () => {
    for (const t of [
      '칼로리는 500 정도',
      '[]',
      '{"menu":"","kcal":300,"protein_g":10}',
      '{"menu":"피자","kcal":5001,"protein_g":10}',
      '{"menu":"피자","kcal":-1,"protein_g":10}',
      '{"menu":"피자","kcal":800,"protein_g":301}',
      '{"menu":"피자","kcal":"800","protein_g":30}',
    ])
      expect(parseAnswer(t)).toEqual({ ok: false, code: 'bad_answer' })
  })
})

describe('answerText', () => {
  it('생각 과정 부분은 빼고 답만', () => {
    expect(answerText({ candidates: [{ content: { parts: [{ text: '고민 중', thought: true }, { text: '{"a":' }, { text: '1}' }] } }] })).toBe('{"a":1}')
    expect(answerText({ promptFeedback: { blockReason: 'SAFETY' } })).toBeNull()
  })
})

describe('toBase64', () => {
  it('큰 사진도 나눠서 변환', () => {
    const bytes = new Uint8Array(100_000).map((_, i) => i % 256)
    expect(Buffer.from(toBase64(bytes), 'base64').equals(Buffer.from(bytes))).toBe(true)
  })
})

describe('handle', () => {
  const env = (extra: Record<string, string> = {}) => {
    const v: Record<string, string> = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', GEMINI_API_KEY: 'gk', ...extra }
    return { get: (k: string) => v[k] }
  }
  const req = (body: unknown, auth = 'Bearer user-token') =>
    new Request('https://x.supabase.co/functions/v1/meal-analyze', { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const geminiAnswer = (text: string) => Response.json({ candidates: [{ content: { parts: [{ text }] } }] })

  function mockFetch(opts: { allowed?: boolean; gemini?: () => Response } = {}) {
    const calls: { url: string; init?: RequestInit }[] = []
    const fn = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      if (url.endsWith('/rest/v1/rpc/is_allowed')) return Response.json(opts.allowed ?? true)
      if (url.includes('/storage/v1/object/authenticated/meal-photos/')) return new Response(new Uint8Array([1, 2, 3]))
      if (url.startsWith('https://generativelanguage.googleapis.com/'))
        return (opts.gemini ?? (() => geminiAnswer('{"menu":"제육볶음 정식","kcal":780,"protein_g":35,"confidence":"medium","is_food":true}')))()
      return new Response('없음', { status: 404 })
    })
    vi.stubGlobal('fetch', fn)
    return calls
  }
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('사진을 Gemini에 보내고 추정을 돌려줌', async () => {
    const calls = mockFetch()
    const res = await handle(req({ photo_path: '2026-10-16/m_2026-10-16_lunch-abc.jpg' }), env())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ menu: '제육볶음 정식', kcal: 780, protein_g: 35, confidence: 'medium', model: DEFAULT_MODEL })
    // 계정 확인과 사진 받기는 대표님 로그인 토큰으로
    expect((calls[0].init!.headers as Record<string, string>).Authorization).toBe('Bearer user-token')
    expect((calls[1].init!.headers as Record<string, string>).Authorization).toBe('Bearer user-token')
    const g = calls[2]
    expect(g.url).toContain(`/models/${DEFAULT_MODEL}:generateContent`)
    expect((g.init!.headers as Record<string, string>)['x-goog-api-key']).toBe('gk')
    const body = JSON.parse(String(g.init!.body))
    expect(body.contents[0].parts[0].inlineData).toEqual({ mimeType: 'image/jpeg', data: 'AQID' })
    expect(body.generationConfig.responseMimeType).toBe('application/json')
  })

  it('GEMINI_MODEL로 모델을 바꿈, 새 키 형식(공개 키 묶음)도 읽음', async () => {
    const calls = mockFetch()
    const e = env({ GEMINI_MODEL: 'gemini-3.5-flash-lite', SUPABASE_ANON_KEY: '', SUPABASE_PUBLISHABLE_KEYS: '{"default":"sb_publishable_x"}' })
    const res = await handle(req({ photo_path: '2026-10-16/a.jpg' }), e)
    expect(res.status).toBe(200)
    expect((calls[0].init!.headers as Record<string, string>).apikey).toBe('sb_publishable_x')
    expect(calls[2].url).toContain('/models/gemini-3.5-flash-lite:generateContent')
  })

  it('키가 없으면 not_configured', async () => {
    mockFetch()
    const res = await handle(req({ photo_path: '2026-10-16/a.jpg' }), env({ GEMINI_API_KEY: '' }))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'not_configured' })
  })

  it('허용 계정이 아니거나 로그인이 없으면 막음', async () => {
    mockFetch({ allowed: false })
    expect((await handle(req({ photo_path: '2026-10-16/a.jpg' }), env())).status).toBe(403)
    expect((await handle(req({ photo_path: '2026-10-16/a.jpg' }, ''), env())).status).toBe(401)
  })

  it('사진 경로가 이상하면 400', async () => {
    mockFetch()
    for (const p of ['../secret.jpg', '2026-10-16/a.png', 'a.jpg', 42]) expect((await handle(req({ photo_path: p }), env())).status).toBe(400)
  })

  it('하루 한도(429)는 rate_limit, 이상한 답은 422', async () => {
    mockFetch({ gemini: () => new Response('{"error":{"code":429}}', { status: 429 }) })
    let res = await handle(req({ photo_path: '2026-10-16/a.jpg' }), env())
    expect([res.status, (await res.json()).error]).toEqual([429, 'rate_limit'])
    mockFetch({ gemini: () => geminiAnswer('{"menu":"피자","kcal":9000,"protein_g":10}') })
    res = await handle(req({ photo_path: '2026-10-16/a.jpg' }), env())
    expect([res.status, (await res.json()).error]).toEqual([422, 'bad_answer'])
    mockFetch({ gemini: () => new Response('{"error":{"message":"API key not valid"}}', { status: 400 }) })
    res = await handle(req({ photo_path: '2026-10-16/a.jpg' }), env())
    expect((await res.json()).error).toBe('bad_key')
  })

  it('브라우저 사전 확인(OPTIONS)에 응답', async () => {
    const res = await handle(new Request('https://x/f', { method: 'OPTIONS', headers: { 'Access-Control-Request-Headers': 'authorization, apikey, x-client-info' } }), env())
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('authorization, apikey, x-client-info')
  })
})
