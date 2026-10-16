# 개인 운동 대시보드 시스템 구조 설계·기능 명세서 (4차)

- 작성일: 2026-10-14
- 근거: 대표 본인 인터뷰 (구조 설계 → API 명세 → 배치 명세 → I/F 명세 → 안정성 대비)
- 앞 단계 문서: [문제 정의서 (1차)](./01-problem-definition.md), [업무/데이터 분석서 (2차)](./02-business-data-analysis.md), [UX/IA 설계서 (3차)](./03-ux-ia-design.md)
- 읽는 법: 각 장의 **"한눈에 보기"**는 대표님용 요약이고, 그 아래 표는 개발할 때 쓰는 세부 명세입니다.
- **"구현 시 확인"** 표시는 무료 서비스 조건이 바뀔 수 있어 개발을 시작할 때 다시 확인할 항목입니다.

---

## 0. 인터뷰에서 확정한 것

| 항목 | 결정 |
|---|---|
| 앱 형태 | 아이폰 홈 화면에 추가하는 웹앱. PC는 같은 주소로 열람 |
| 비용 | 전부 무료 범위 안 |
| 식단 사진 분석 | Google Gemini 무료 등급 (Hugging Face는 무료 계정 월 무료 사용량이 없어 제외) |
| 개발·수정 | Claude가 개발, 대표님은 결과 확인 |
| 기록 수정·삭제 | 둘 다 가능 |
| 사진 저장 | 화질을 줄여 저장 |
| 엑셀 내려받기 | 기간을 골라 받기 |
| 한 주 시작 | 월요일 |
| 알림 | 오전 10시 아침 컨디션 / 오후 10시 운동 기록 + 영양제·보충제. 식사 사진 알림 없음. 이미 했으면 보내지 않음 |
| 사진 다시 분석 | 매일 새벽 자동 |
| 백업 | 별도 비공개 GitHub 저장소, 주 1회, 기록만 (사진 제외) |
| 로그인 | 구글 계정 |
| 시스템 문제 알림 | 아이폰 알림 |

---

## 1. 구조 설계

### 한눈에 보기

```
 ┌───────────────┐      ┌────────────────────────────┐      ┌──────────────┐
 │ ① 화면 (웹앱)    │ ───▶ │ ② 서버 (Supabase 무료)        │ ───▶ │ ③ Gemini AI   │
 │ 아이폰·PC        │ ◀─── │ 기록 저장 · 로그인 · 사진 보관   │ ◀─── │ 식사 사진 분석   │
 └───────────────┘      │ ④ 정기 작업 (매일·매주)          │      └──────────────┘
         ▲              └────────────────────────────┘
         │ 알림                     │ 주 1회 백업
 ┌───────────────┐      ┌────────────────────────────┐
 │ 아이폰 알림 서비스 │      │ 비공개 GitHub 백업 저장소         │
 └───────────────┘      └────────────────────────────┘
```

### 구성 요소

| 구성 | 사용 기술 (무료) | 역할 |
|---|---|---|
| ① 화면 | PWA 웹앱 (React + Vite), Cloudflare Pages에 배포 | 화면 표시, 입력, 사진 압축, 엑셀 생성, 입력 임시 보관 |
| ② 데이터베이스 | Supabase Postgres | 모든 기록 저장, 하루 상태·주간 KPI 계산 |
| ② 로그인 | Supabase Auth + Google 로그인 | 대표님 구글 계정 1개만 허용 |
| ② 사진 보관 | Supabase Storage (비공개 저장소 `meal-photos`) | 줄인 사진 보관 |
| ② 서버 기능 | Supabase Edge Functions | Gemini 호출, 알림 발송, 정기 작업 실행 |
| ④ 정기 작업 | Supabase Cron + GitHub Actions | 하루 마감, KPI 계산, 알림, 재분석, 백업, 서버 깨우기 |
| ③ AI | Google Gemini API 무료 등급 | 사진 → 메뉴·칼로리·단백질 추정 |
| 알림 | Web Push (iOS 16.4 이상, 홈 화면에 추가한 웹앱) | 오전 10시·오후 10시 알림, 시스템 문제 알림 |
| 백업 | GitHub Actions → 비공개 저장소 | 주 1회 기록 사본 |

- 코드 저장소: `honggihyuk/Workout_Condition_Checklist`
- 시간 기준: 모든 날짜·알림은 **한국 시간(KST)** 기준. 하루의 끝은 자정 (2차 가정).

### 무료 한도와 예상 사용량

| 항목 | 무료 한도 | 예상 사용량 | 구현 시 확인 |
|---|---|---|---|
| Supabase 데이터베이스 | 500MB | 텍스트 기록이라 수년간 수십 MB 수준 (추정) | ✓ |
| Supabase 사진 보관 | 1GB | 사진 1장 약 200KB로 줄이면 하루 3~4장 기준 연 약 250MB (추정) | ✓ |
| Supabase 비활성 | 1주 사용이 없으면 일시정지 | 매일 깨우기 작업으로 방지 | ✓ |
| Gemini 무료 등급 | 하루 요청 수 제한 (모델별, AI Studio에서 확인) | 하루 3~4장 + 재분석 | ✓ |
| Cloudflare Pages | 개인 사용에 충분 | | |
| GitHub Actions | 비공개 저장소 월 무료 실행 시간 | 주 1회 백업 + 매일 깨우기, 몇 분 수준 | ✓ |

---

## 2. API 명세

### 한눈에 보기

화면이 서버에 요청하는 일입니다. 기본적인 저장·불러오기·수정·삭제는 Supabase가 기록장마다 자동으로 제공하고, 계산이나 AI가 필요한 일만 따로 만듭니다.

### 2-1. 데이터 표 (2차 데이터 정의 기준)

| 표 이름 | 담는 것 | 주요 칸 |
|---|---|---|
| `exercises` | 운동 라이브러리 (기본 운동 + 직접 만든 운동) | id, name, body_part(가슴/등/하체/어깨/팔/복근/유산소), equipment(바벨/덤벨/머신/케이블/맨몸), kind(weight/run), is_custom, hidden |
| `routines` | 내 루틴 | id, name, sort_order (다음 차례 계산용), kind(weight/run, 러닝 루틴은 다음 차례 순서에서 빠짐), target_km, target_pace_sec(1km당 초, 러닝 루틴 목표) |
| `routine_items` | 루틴에 든 운동 | routine_id, exercise_id, position, default_sets |
| `supplements` | 영양제·보충제 목록 | id, name, short_name(체크 버튼용 짧은 이름), schedule(daily/workout), optional_on_run_only(쉐이크만 true), sort_order, hidden, serving_g·protein_g·kcal(먹은 날 식단 합계에 더할 1회 양·성분, 쉐이크 기본 40g·36g·150kcal) |
| `workouts` | 그날 운동 (하루 한 건) | id, date, routine_id(다음 차례 계산용), memo |
| `workout_sets` | 웨이트 세트 | id, date, exercise_id, exercise_pos(그날 운동 순서), set_no, weight_kg, reps |
| `runs` | 러닝 | id, date, distance_km, duration_sec, memo. 화면에서는 거리·평균 페이스를 적고, 시간(거리 × 페이스)으로 저장. 페이스는 시간 ÷ 거리로 다시 계산 |
| `meals` | 식사 | id, date, slot(breakfast/lunch/dinner/snack), eaten_at, photo_path, status, ai_menu, ai_kcal, ai_protein_g, manual_menu, manual_g, manual_kcal, manual_protein_g, memo |
| `supplement_logs` | 복용 체크 | id, date, supplement_id, taken_at |
| `conditions` | 컨디션 | id, date, type(morning/post_workout), fatigue, sleep_quality, intensity, focus |
| `body_weights` | 체중 | id, date, weight_kg |
| `inbody` | 인바디 | id, date, skeletal_muscle_kg, body_fat_pct, body_fat_kg, bmr_kcal |
| `day_status` | 하루 루틴 상태 | date, is_workout_day, status(in_progress/done/missed), missing_items, closed |
| `weekly_kpi` | 주간 KPI | week_start(월요일), workout_count, meal_photo_count |
| `push_subscriptions` | 알림 받을 기기 | id, endpoint, keys |
| `notification_log` | 보낸 알림 | date, type (date+type 중복 금지) |
| `job_runs` | 정기 작업 실행 기록 | job, run_key, status, error, started_at |

- 모든 기록 표에는 `owner`(로그인 사용자) 칸이 있고, 본인 기록만 읽고 쓸 수 있게 막습니다 (RLS).
- 모든 기록의 id는 화면에서 미리 만들어 보냅니다. 같은 저장 요청이 두 번 와도 한 건만 남습니다 (5장 중복 실행 참고).
- 6차 MVP 구축 때 바뀐 점: 운동 메모와 루틴을 담는 `workouts` 표 추가, 세트의 메모는 `workouts.memo`로 옮김, 식사 직접 입력에 메뉴·단백질 칸 추가. 실제 구조는 [supabase/migrations/0001_init.sql](../supabase/migrations/0001_init.sql)이 기준입니다.
- `meals.status`: `empty`(미기록) → `uploaded`(사진 올림·분석 중) → `estimated`(확인 필요) → `confirmed`(확인함), 실패 시 `failed`. 3차 상태 정의와 같습니다.

### 2-2. 기본 저장·불러오기 (Supabase 자동 제공)

| 기능 | 방식 | 대상 |
|---|---|---|
| 기록 불러오기 | `GET /rest/v1/{표}?date=...` | 위 기록 표 전부 |
| 기록 저장 | `POST /rest/v1/{표}` (같은 id면 덮어쓰기) | 〃 |
| 기록 수정 | `PATCH /rest/v1/{표}?id=eq.{id}` | 〃 |
| 기록 삭제 | `DELETE /rest/v1/{표}?id=eq.{id}` | 〃 |
| 사진 올리기 | `POST /storage/v1/object/meal-photos/{날짜}/{meal_id}.jpg` | 화면에서 긴 변 1280px, JPEG 품질 70%로 줄인 뒤 올림 |
| 사진 보기 | 서명된 임시 주소 발급 (비공개 저장소) | |

### 2-3. 계산이 필요한 기능 (데이터베이스 함수)

| 기능 | 호출 | 입력 | 결과 | 쓰는 화면 |
|---|---|---|---|---|
| 하루 루틴 상태 | `rpc/get_day_status` | 날짜 | 운동하는 날 여부, 상태, 남은 항목 목록 | 오늘, 달력 |
| 달력 | `rpc/get_month_status` | 연·월 | 날짜별 상태 | 달력 |
| 주간 KPI | `rpc/get_weekly_kpi` | 주 시작일 | 운동 횟수 / 목표 4, 식사 사진 끼 수, 인바디 최근 판정 | 오늘 |
| 운동 최근 흐름 | `rpc/get_exercise_history` | 운동 id, 횟수(기본 5) | 최근 5회 날짜별 세트·무게·횟수, 볼륨 | 운동 (전) |
| 지난번 값 채우기 | `rpc/get_last_sets` | 운동 id | 지난번 세트별 무게·횟수 | 운동 (후) |
| 다음 차례 루틴 | `rpc/get_next_routine` | 없음 | 마지막으로 한 루틴의 다음 루틴 | 운동 홈, 오늘 |
| 최근 한 운동 | `rpc/get_recent_exercises` | 개수(기본 5) | 최근에 기록한 운동과 마지막 기록 | 운동 고르기 |
| 몸 변화 추세 | `rpc/get_body_trend` | 시작일, 종료일 (기본 1개월) | 체중·인바디·컨디션 추이, 인바디 좋음/주의 | 몸 변화 |
| 엑셀용 데이터 | `rpc/export_records` | 시작일, 종료일 | 기간 안의 모든 기록 | 설정 → 엑셀 내려받기 |

- 하루 루틴 상태 규칙은 2차 분석서 3장을 그대로 따릅니다. 운동 기록(헬스 또는 러닝)이 있으면 운동하는 날, 러닝만 한 날은 쉐이크가 선택입니다.
- 지난 날짜의 기록을 채우거나 고치면 그날의 `day_status`를 즉시 다시 계산합니다 (놓친 항목 있음 → 완료).

### 2-4. 서버 기능 (Edge Functions)

| 기능 | 호출 | 입력 | 결과 | 실패 시 |
|---|---|---|---|---|
| 식사 사진 분석 | `POST /functions/v1/meal-analyze` | photo_path (6차에서 바꿈) | 메뉴·칼로리·단백질·확신 정도. 화면이 받아서 status=`estimated`로 저장 (6차에서 바꿈) | status=`failed`, 화면은 직접 입력 칸을 엶 |
| 알림 기기 등록 | `POST /functions/v1/push-subscribe` | 알림 구독 정보 | 등록 완료 | 화면에 "알림 설정 실패, 다시 시도" |
| 알림 기기 해제 | `POST /functions/v1/push-unsubscribe` | endpoint | 해제 완료 | |

- 엑셀 파일은 서버가 아니라 **화면에서** 만듭니다 (`export_records` 결과 → xlsx). 기록 종류마다 시트 하나씩입니다.

---

## 3. 배치 명세

### 한눈에 보기

사람이 누르지 않아도 정해진 시간에 시스템이 알아서 하는 일입니다.

| 작업 | 언제 (한국 시간) | 하는 일 |
|---|---|---|
| 하루 마감 | 매일 00:05 | 어제 루틴을 완료 / 놓친 항목 있음으로 확정 |
| 주간 KPI 계산 | 매주 월요일 00:10 | 지난주 운동 횟수·식사 사진 기록률 확정 |
| 아침 알림 | 매일 10:00 | 아침 컨디션을 안 했으면 알림 |
| 저녁 알림 | 매일 22:00 | 운동 기록이나 영양제·보충제 체크가 남았으면 한 번에 알림 |
| 사진 다시 분석 | 매일 04:00 | 분석 실패 + 직접 입력도 안 한 사진 다시 분석 |
| 데이터 백업 | 매주 일요일 03:00 | 기록 전체를 비공개 GitHub 저장소에 저장 |
| 서버 깨우기 | 매일 06:00 | 무료 서버가 멈추지 않게 가볍게 요청 |
| 상태 점검 | 매주 일요일 03:30 | 저장 공간·작업 실패 확인, 문제 있으면 아이폰 알림 |

### 세부 명세

| 작업 | 실행 위치 | 중복 실행 방지 키 | 처리 내용 | 실패 시 |
|---|---|---|---|---|
| daily-close | Supabase Cron → DB 함수 | 날짜 | 아직 `closed=false`인 지난 날짜 전부를 다시 계산해 확정 (빠진 날까지 모아서 처리) | 다음 날 실행 때 함께 처리 |
| weekly-kpi | Supabase Cron → DB 함수 | 주 시작일 | `weekly_kpi`에 덮어쓰기 저장 | 다음 실행 때 빠진 주까지 처리 |
| remind-morning | Supabase Cron → Edge Function | 날짜 + `morning` | 오늘 `conditions(type=morning)`이 없으면 "아침 컨디션을 체크해 주세요" | 1회 재시도, 그래도 실패하면 `job_runs`에 기록 |
| remind-evening | Supabase Cron → Edge Function | 날짜 + `evening` | 운동 기록이 없거나 영양제·보충제가 남았으면 "운동 기록하셨나요? 영양제 N개 남음". 다 했으면 보내지 않음 | 〃 |
| meal-reanalyze | Supabase Cron → Edge Function | meal_id | 최근 7일 안의 `failed` 사진 중 직접 입력 없는 것을 한 번에 최대 10장 분석 | 한도 초과면 멈추고 다음 날 계속 |
| backup | GitHub Actions (백업 저장소) | 주 시작일 | 모든 기록 표를 CSV로 내보내 커밋. 사진 제외 | 대표님께 아이폰 알림 |
| keep-alive | GitHub Actions | 날짜 | Supabase에 가벼운 조회 1회 | 다음 날 재시도. 3일 연속 실패면 알림 |
| health-check | Supabase Cron → Edge Function | 주 시작일 | 사진 보관 80% 이상, 작업 2회 연속 실패, 백업 실패를 확인 | 문제 있으면 아이폰 알림 |

- Supabase Cron은 세계 표준시(UTC)로 동작하므로 한국 시간에서 9시간을 빼서 등록합니다 (예: 00:05 KST = 전날 15:05 UTC).
- 모든 작업은 시작·종료·오류를 `job_runs`에 남깁니다.

---

## 4. I/F 명세

### 한눈에 보기

| 연결 대상 | 보내는 것 | 받는 것 |
|---|---|---|
| Gemini AI | 줄인 식사 사진 (이름 등 개인정보 없음) | 메뉴·칼로리·단백질 추정 |
| Google 로그인 | 로그인 요청 | 대표님 계정 확인 |
| 아이폰 알림 서비스 | 알림 문구 | 전달 결과 |
| 엑셀 파일 | (화면 안에서 생성) | 기간별 기록 파일 |
| GitHub 백업 저장소 | 주 1회 기록 CSV | |

### 4-1. Gemini AI

| 항목 | 내용 |
|---|---|
| 호출 위치 | Edge Function `meal-analyze`, `meal-reanalyze` (API 키는 서버에만 보관) |
| 모델 | 설정값 `GEMINI_MODEL`로 지정. 무료 등급에서 사진 입력을 지원하는 Flash 계열. 6차 확인: 기본 `gemini-3.8-flash` (2026-10 새 프로젝트 권장, 2.5 계열은 기존 사용자만) |
| 보내는 것 | 사진 1장 + 고정 지시문 "이 음식 사진의 메뉴, 총 칼로리(kcal), 단백질(g)을 한국어 JSON으로 추정" |
| 받는 형식 | `{ "menu": "닭가슴살 샐러드", "kcal": 420, "protein_g": 35, "confidence": "medium", "is_food": true }` (6차에서 음식 여부 추가) |
| 검사 | JSON이 아니거나, kcal이 0~5000 밖이거나, protein_g가 0~300 밖이면 실패로 처리 |
| 제한 시간 | 30초 |
| 오류 처리 | 한도 초과(429) → `failed` + 새벽 재분석 대상 / 그 밖의 오류 → `failed` / 둘 다 화면은 직접 입력 칸을 엶 |
| 유의 | 무료 등급에 보낸 사진은 구글 서비스 개선에 쓰일 수 있음 (인터뷰에서 안내함) |

### 4-2. Google 로그인 (Supabase Auth)

| 항목 | 내용 |
|---|---|
| 방식 | Google OAuth. 구글 클라우드에서 로그인용 클라이언트 생성 후 Supabase에 등록 |
| 허용 계정 | 대표님 구글 계정 1개 (설정값). 다른 계정은 로그인 거부 |
| 새 가입 | 막음 |
| 로그인 유지 | 자동 연장 (refresh token). 한 번 로그인하면 기기마다 오래 유지 |

### 4-3. 아이폰 알림 (Web Push)

| 항목 | 내용 |
|---|---|
| 조건 | iOS 16.4 이상, 웹앱을 홈 화면에 추가한 뒤 알림 허용 |
| 인증 | VAPID 키 (서버에 보관) |
| 보내는 형식 | `{ "title": "...", "body": "...", "url": "/today" }` 누르면 해당 화면으로 이동 |
| 기기 만료 | 알림 서비스가 "없는 기기"(404/410)로 답하면 그 기기 등록을 지움 |
| 종류 | 아침 컨디션, 저녁 운동·영양제, 시스템 문제 |

### 4-4. 엑셀 내려받기

| 항목 | 내용 |
|---|---|
| 위치 | 설정 화면 → 기간 선택 → 내려받기 |
| 생성 | 화면에서 생성 (SheetJS) |
| 파일 | `운동기록_YYYYMMDD-YYYYMMDD.xlsx` |
| 시트 | 운동, 러닝, 식사, 영양제·보충제, 컨디션, 체중, 인바디 |
| 사진 | 포함하지 않음 (사진이 있는지만 표시) |

### 4-5. GitHub 백업 저장소

| 항목 | 내용 |
|---|---|
| 저장소 | 새 비공개 저장소 (예: `workout-dashboard-backup`), 대표님 GitHub 계정 |
| 실행 | 저장소 안의 GitHub Actions 예약 실행 |
| 내용 | `backup/YYYY-MM-DD/{표}.csv` 기록 표 전부, 사진 제외 |
| 비밀값 | Supabase 접속 키는 GitHub 비밀값(Secrets)에만 보관 |

---

## 5. 안정성 대비

| 상황 | 대비 | 구현 방법 |
|---|---|---|
| **사용자/권한 관리** | 대표님 계정 하나만 허용, 새 가입 막기 | 허용 계정 확인 + 새 가입 끔 + 모든 표에 본인 기록만 접근 (RLS) |
| **API 변경** | Gemini가 바뀌거나 멈추면 분석 실패로 처리하고 직접 입력으로 이어감. 설정만 바꿔 모델 교체 | 모델 이름·지시문을 설정값으로 분리. 받은 답의 형식을 검사해 어긋나면 실패 처리 |
| **인증 만료** | 로그인 자동 연장. 만료되면 입력 중이던 기록을 폰에 잠시 보관했다가 다시 로그인한 뒤 저장 | refresh token 자동 갱신. 저장 실패한 기록은 기기 저장소(IndexedDB)에 두고 로그인 후 자동 재전송. Gemini·VAPID 키 오류는 시스템 문제 알림 |
| **데이터 오류** | 말이 안 되는 값은 저장 전에 막고, 지난번과 크게 다르면 "맞나요?" 확인 | 아래 범위표 적용. 화면과 데이터베이스 양쪽에서 검사 |
| **중복 실행** | 저장 버튼을 두 번 눌러도 한 번만 저장. 배치가 두 번 돌아도 결과는 한 번만 반영. 알림은 하루 한 번 | 화면에서 만든 id로 덮어쓰기 저장. 저장 중에는 버튼을 잠금. 배치는 중복 방지 키로 덮어쓰기. `notification_log` 날짜+종류 중복 금지 |
| **rate limit** | Gemini 하루 한도를 넘으면 새벽 재분석으로 넘김. 무료 서버는 매일 깨워 둠 | 429 응답 시 즉시 멈추고 `failed` 처리. 재분석은 한 번에 최대 10장. keep-alive 작업 |
| **실행 실패** | 배치가 실패하면 다음 실행 때 빠진 날까지 모아서 처리. 문제는 대표님께 아이폰 알림 | `job_runs` 기록. 2회 연속 실패, 백업 실패, 저장 공간 80% 이상이면 알림 |

### 데이터 오류 범위표

| 값 | 막는 범위 (저장 안 됨) | 확인하는 경우 ("맞나요?") |
|---|---|---|
| 세트 무게 | 0kg 미만, 400kg 초과 | 지난번 같은 운동보다 30% 넘게 다름 |
| 횟수 | 1 미만, 100 초과 | |
| 러닝 거리 | 0km 이하, 100km 초과 | |
| 러닝 평균 페이스 (6차 추가) | 1km당 2분 미만, 30분 초과 | 지난번 러닝보다 30% 넘게 다름 |
| 체중 | 30kg 미만, 200kg 초과 | 지난번보다 3kg 넘게 다름 |
| 체지방률 | 2% 미만, 60% 초과 | 지난달보다 5%p 넘게 다름 |
| 한 끼 칼로리 (직접 입력) | 0 미만, 5000 초과 | |
| 컨디션 점수 | 1~5 밖 | |

- 범위는 기본값이며 쓰면서 조정할 수 있습니다.

---

## 6. 구현 시 확인할 것

1. Gemini 무료 등급의 하루 요청 한도와 사진 입력 가능한 모델 (Google AI Studio 한도 화면). 6차 확인: 사진 입력 가능한 무료 모델 `gemini-3.8-flash`를 기본으로 함. 하루 한도는 프로젝트마다 AI Studio에서 보여 주며 공개 표는 없음
2. Supabase 무료 등급의 일시정지 규칙, Cron 사용 가능 여부, 저장 한도
3. GitHub 비공개 저장소의 Actions 무료 실행 시간
4. ~~대표님 아이폰 iOS 버전이 16.4 이상인지 (알림 조건)~~ 확인 완료: iOS 26.1

## 참고한 자료

- [Hugging Face Inference Providers 가격 문서](https://huggingface.co/docs/inference-providers/pricing): 무료 계정 월 포함 사용량 없음
- [Hugging Face 포럼: 무료 CPU Space 변경 보고](https://discuss.huggingface.co/t/official-community-complaint-revert-free-cpu-basic-spaces-and-remove-anti-developer-sdk-restrictions/177703)
- [Gemini API 사용 한도 문서](https://ai.google.dev/gemini-api/docs/rate-limits): 무료 등급 존재, 모델별 한도는 AI Studio에서 확인
- [Gemini API 변경 기록](https://ai.google.dev/gemini-api/docs/changelog): 2026-09 이후 2.5 계열은 기존 사용자만, 새 프로젝트는 3.8 Flash·3.5 Flash-Lite 권장 (6차 확인)
- [Supabase 새 API 키 안내](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys): Publishable key는 anon key와 같은 권한, 서버 기능의 기본 JWT 확인은 예전 키 형식만 이해함 (6차 확인)
- [Supabase 무료 등급 한도 정리 (2026년 5월 기준)](https://automationatlas.io/answers/supabase-free-tier-limits-2026/): DB 500MB, 저장 1GB, 1주 비활성 시 일시정지
