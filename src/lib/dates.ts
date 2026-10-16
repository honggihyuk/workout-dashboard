// 날짜 도우미. 모든 날짜는 한국 시간(KST) 기준 'YYYY-MM-DD' (docs/04-system-design.md 1장)

const kstFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const kstTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function toKstDate(d: Date): string {
  return kstFormat.format(d)
}

export function today(): string {
  return toKstDate(new Date())
}

/** 지금 한국 시간 'HH:MM' */
export function nowTime(): string {
  return kstTime.format(new Date())
}

/** ISO 시각 → 한국 시간 'HH:MM' */
export function isoToTime(iso: string): string {
  return kstTime.format(new Date(iso))
}

function parse(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function format(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(date: string, n: number): string {
  const d = parse(date)
  d.setUTCDate(d.getUTCDate() + n)
  return format(d)
}

export function addMonths(date: string, n: number): string {
  const d = parse(date)
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + n)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return format(d)
}

/** 0=월 … 6=일 */
export function weekday(date: string): number {
  return (parse(date).getUTCDay() + 6) % 7
}

const dayNames = ['월', '화', '수', '목', '금', '토', '일']

export function weekdayName(date: string): string {
  return dayNames[weekday(date)]
}

/** 한 주 시작은 월요일 (4차 확정) */
export function weekStart(date: string): string {
  return addDays(date, -weekday(date))
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86400000)
}

/** from부터 to까지(포함) 날짜 목록 */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

export function monthStart(date: string): string {
  return date.slice(0, 8) + '01'
}

export function monthEnd(date: string): string {
  return addDays(addMonths(monthStart(date), 1), -1)
}

/** '10월 14일 (수)' */
export function longLabel(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  return `${m}월 ${d}일 (${weekdayName(date)})`
}

/** '10/14' */
export function shortLabel(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  return `${m}/${d}`
}

/** '2026년 10월' */
export function monthLabel(date: string): string {
  const [y, m] = date.split('-').map(Number)
  return `${y}년 ${m}월`
}

export function isValidDate(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && format(parse(s)) === s
}
