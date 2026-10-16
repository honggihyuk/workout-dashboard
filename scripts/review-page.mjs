// 검수판 한 장짜리 페이지 만들기: dist-demo(체험판 빌드)의 CSS·JS를 한 파일에 넣습니다.
// 사용: npm run build:demo && node scripts/review-page.mjs dist-demo 출력파일.html
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const [dir = 'dist-demo', out = 'dist-demo/review.html'] = process.argv.slice(2)
const html = readFileSync(join(dir, 'index.html'), 'utf8')

const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/g)].map((m) => readFileSync(join(dir, m[1]), 'utf8'))
const js = [...html.matchAll(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/g)].map((m) => readFileSync(join(dir, m[1]), 'utf8'))
if (!css.length || !js.length) throw new Error('빌드 결과에서 CSS·JS를 찾지 못했어요')

const esc = (s) => s.replace(/<\/(script|style)/gi, '<\\/$1')
const page = [
  '<title>운동 대시보드 체험판</title>',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gothic+A1:wght@400;600;800&display=swap">',
  `<style>${esc(css.join('\n'))}</style>`,
  '<div id="root"></div>',
  `<script type="module">${esc(js.join('\n'))}</script>`,
].join('\n')
writeFileSync(out, page)
console.log(`${out} (${Math.round(page.length / 1024)}KB)`)
