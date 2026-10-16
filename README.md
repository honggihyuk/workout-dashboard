# 운동 대시보드 (Workout Condition Checklist)

린매스업 중인 한 사람(대표님)을 위한 개인 운동 대시보드입니다. 운동·식단·영양제·컨디션 기록을 **최소한의 입력**으로 매일 쌓고, 한 화면에서 루틴과 몸 변화를 확인합니다.

## 진행 단계

| 단계 | 내용 | 상태 | 문서 |
|---|---|---|---|
| 1차 | 문제 정의 | 완료 | [01-problem-definition.md](docs/01-problem-definition.md) |
| 2차 | 업무/데이터 분석 | 완료 | [02-business-data-analysis.md](docs/02-business-data-analysis.md) |
| 3차 | UX/IA 설계 | 완료 | [03-ux-ia-design.md](docs/03-ux-ia-design.md) |
| 4차 | 시스템 구조 설계·기능 명세 | 완료 | [04-system-design.md](docs/04-system-design.md) |
| 5차 | UI 디자인 (프레임 목업 → UI 의사결정 → 테마 선택) | 완료 | [05-ui-design.md](docs/05-ui-design.md) |
| 6차 | 구축 및 검수 (MVP 범위 구축 → 검수 및 안정화 → 배포(CI/CD) → 추가 구축) | 진행 중 | [06-build.md](docs/06-build.md) |

모든 결정 사항은 [docs/decisions.md](docs/decisions.md)에 한곳으로 모아 둡니다.

## 기술 구성

- 화면: React + Vite + TypeScript, 아이폰 홈 화면에 추가하는 웹앱(PWA)
- 배포: Cloudflare Pages (무료)
- 서버: Supabase 무료 (데이터베이스, 구글 로그인, 사진 보관, Edge Functions, Cron)
- 식단 사진 분석: Google Gemini 무료 등급
- 백업: 별도 비공개 GitHub 저장소 (GitHub Actions)

자세한 구조는 [04-system-design.md](docs/04-system-design.md)를 봅니다.

## 실행 방법 (개발용)

```bash
npm install
npm run dev        # 개발 서버
npm run build      # 타입 검사 + 배포용 빌드 (dist/)
npm test           # 계산 규칙과 사진 분석 서버 기능 시험
npm run build:demo # 예시 기록으로 도는 체험판 빌드 (dist-demo/)
npm run review:page # 체험판을 파일 하나로 묶은 검수판 (dist-demo/review.html)
```

서버 값(`.env`)이 없으면 예시 기록으로 도는 체험판으로 열립니다. 실제 서버 연결은 [docs/setup.md](docs/setup.md)의 단계별 안내를 따릅니다.

## 폴더 구조

```
docs/          단계별 설계 문서와 결정 사항 모음
src/           화면 코드
  screens/     탭별 화면 (오늘, 달력, 운동, 식단, 몸 변화, 설정)
  components/  여러 화면이 같이 쓰는 부품 (버튼, 그래프, 운동 고르기 등)
  lib/         날짜·계산 규칙·저장 방식 (체험판 / 실제 서버)
supabase/      서버 표 구조와 보안 규칙 (SQL), 사진 AI 분석 서버 기능 (functions/meal-analyze)
scripts/       검수판 만들기 도구
public/        정적 파일 (앱 아이콘, Cloudflare Pages 설정 포함)
```
