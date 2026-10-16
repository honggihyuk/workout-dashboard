# 실제 서버 연결 안내서

체험판(예시 기록)에서 **대표님 기록이 실제로 저장되는 앱**으로 바꾸는 순서입니다. 한 번만 하면 됩니다.

- 준비물: PC 브라우저, 대표님 구글 계정, 약 40분
- 비용: 모두 무료 등급입니다. 결제 정보(카드)는 어디에도 연결하지 않습니다.
- 비밀값 주의: 4단계의 Client secret, 5단계의 Gemini 키는 **그 사이트 칸에만** 붙여 넣습니다. 채팅이나 GitHub에는 올리지 않습니다.
- 사이트 화면의 메뉴 이름은 조금씩 바뀔 수 있습니다. 비슷한 이름을 찾으시면 됩니다.

| 단계 | 하는 일 | 사이트 |
|---|---|---|
| 1 | 서버(Supabase) 만들기 | supabase.com |
| 2 | 기록 표 만들기 | Supabase |
| 3 | 대표님 계정 등록 | Supabase |
| 4 | 구글 로그인 연결 | Google Cloud, Supabase |
| 5 | 사진 AI(Gemini) 키 만들기 | aistudio.google.com |
| 6 | 사진 분석 기능 올리기 | Supabase |
| 7 | 앱 화면 올리기 | Cloudflare |
| 8 | 로그인 주소 등록 | Supabase |
| 9 | 아이폰에서 열고 확인 | 아이폰 사파리 |

---

## 1단계. 서버(Supabase) 만들기

1. [supabase.com](https://supabase.com) → **Start your project** → 가입(GitHub 또는 이메일).
2. **New project**
   - Name: `workout-dashboard`
   - Database Password: **Generate a password**를 누르고 따로 적어 둡니다 (평소에는 쓸 일이 없습니다).
   - Region: **Northeast Asia (Seoul)**
   - Plan: **Free**
3. 1~2분 기다리면 준비됩니다.
4. **Project Settings → API Keys**(또는 **Data API**)에서 두 값을 메모장에 적어 둡니다. 7단계에서 씁니다.
   - **Project URL**: `https://(영문 몇 글자).supabase.co`
   - **Publishable key**: `sb_publishable_`로 시작하는 값 (예전 화면에서는 `anon` `public` 키)
   - 이 두 값은 앱 화면에 들어가는 공개용 값이라 알려져도 괜찮습니다. `secret`, `service_role` 키는 쓰지 않습니다.

## 2단계. 기록 표 만들기

1. GitHub에서 [supabase/migrations/0001_init.sql](https://github.com/honggihyuk/Workout_Condition_Checklist/blob/claude/project-thread-dm7pz1/supabase/migrations/0001_init.sql)을 열고, 오른쪽 위 **복사 버튼(Copy raw file)** 을 누릅니다.
2. Supabase → 왼쪽 **SQL Editor** → **New query** → 붙여 넣기 → **Run**.
3. `Success. No rows returned`가 나오면 성공입니다. **한 번만** 실행합니다 (두 번 실행하면 "이미 있음" 오류가 납니다. 그래도 문제는 없습니다).

## 3단계. 대표님 계정 등록

이 앱은 등록한 구글 계정 하나만 쓸 수 있습니다.

1. SQL Editor → **New query**에 아래 한 줄을 붙여 넣고, 메일 주소만 대표님 구글 메일로 바꿉니다.

   ```sql
   insert into public.app_config (key, value) values ('allowed_email', '대표님메일@gmail.com');
   ```

2. **Run** → `Success`가 나오면 끝입니다.

## 4단계. 구글 로그인 연결

**가. 구글 쪽 설정**

1. [console.cloud.google.com](https://console.cloud.google.com) → 위쪽 프로젝트 선택 → **새 프로젝트** → 이름 `workout-dashboard` → 만들기.
2. 검색창에 **Google Auth Platform** → **시작하기(Get started)**
   - 앱 이름: `운동 대시보드`, 지원 이메일: 대표님 메일
   - 대상(Audience): **외부(External)**
   - 연락처 이메일: 대표님 메일 → 만들기
3. **대상(Audience)** 화면 → **테스트 사용자(Test users)** 에 대표님 메일을 추가합니다.
4. **클라이언트(Clients)** → **클라이언트 만들기**
   - 애플리케이션 유형: **웹 애플리케이션**
   - **승인된 리디렉션 URI**: Supabase → **Authentication → Sign In / Providers → Google**을 열면 나오는 `Callback URL`을 복사해 붙여 넣습니다. 모양은 `https://(1단계 주소).supabase.co/auth/v1/callback`입니다.
   - 만들기 → 나오는 **클라이언트 ID**와 **클라이언트 보안 비밀번호(Client secret)** 를 복사합니다.

**나. Supabase 쪽 설정**

5. Supabase → **Authentication → Sign In / Providers → Google** → 켜기(Enable) → Client ID, Client Secret 붙여 넣기 → **Save**.
6. 같은 화면의 **새 가입 허용(Allow new users to sign up)** 은 켜 둔 채로 둡니다. 3단계에서 등록한 메일 외에는 서버가 가입을 막습니다.

## 5단계. 사진 AI(Gemini) 키 만들기

1. [aistudio.google.com](https://aistudio.google.com) → 대표님 구글 계정으로 로그인.
2. **Get API key → API 키 만들기(Create API key)** → 새 프로젝트로 만들기 → 키를 복사합니다.
3. 결제(Billing)는 연결하지 않습니다. 연결하지 않으면 무료 등급으로만 쓰여 요금이 나오지 않습니다.
4. 알아 두실 점
   - 무료 등급에 보낸 사진은 구글 서비스 개선에 쓰일 수 있습니다 (4차 인터뷰에서 안내드린 내용).
   - 하루에 분석할 수 있는 사진 수는 AI Studio의 **사용량(Usage) / 한도(Rate limit)** 화면에서 볼 수 있습니다. 하루 3~4장이면 충분한 범위입니다.

## 6단계. 사진 분석 기능 올리기

**가. 키 넣기**

1. Supabase → **Edge Functions → Secrets** → **Add new secret**
   - Name: `GEMINI_API_KEY`
   - Value: 5단계에서 복사한 키
   - **Save**
2. 모델은 기본으로 `gemini-3.8-flash`를 씁니다 (2026년 10월 무료 등급에서 새 프로젝트에 권장되는 모델). 나중에 모델을 바꿀 때만 같은 곳에 `GEMINI_MODEL`을 추가합니다.

**나. 기능 올리기**

3. GitHub에서 [supabase/functions/meal-analyze/index.ts](https://github.com/honggihyuk/Workout_Condition_Checklist/blob/claude/project-thread-dm7pz1/supabase/functions/meal-analyze/index.ts)를 열고 **복사 버튼(Copy raw file)** 을 누릅니다.
4. Supabase → **Edge Functions → Deploy a new function → Via Editor**
   - 함수 이름: `meal-analyze` (철자 그대로)
   - 편집기에 들어 있는 예시 글을 모두 지우고 붙여 넣기 → **Deploy function**
5. 올린 함수 화면 → **Details(설정)** → **Verify JWT**(JWT 확인)를 **끄고** 저장합니다. 대표님 계정인지는 기능 안에서 직접 확인하므로 꺼도 안전합니다.

## 7단계. 앱 화면 올리기 (Cloudflare Pages)

1. [dash.cloudflare.com](https://dash.cloudflare.com) → 가입·로그인.
2. **Workers & Pages → 만들기(Create) → Pages → Git에 연결(Connect to Git)** → GitHub 계정 연결 → `Workout_Condition_Checklist` 저장소 선택.
3. 빌드 설정
   - 프로젝트 이름: `workout-dashboard` (주소가 `https://workout-dashboard.pages.dev`처럼 됩니다. 이미 쓰는 이름이면 뒤에 글자가 붙습니다)
   - 프로덕션 브랜치: `claude/project-thread-dm7pz1` (지금 작업이 있는 곳입니다)
   - 프레임워크: **없음(None)**
   - 빌드 명령: `npm run build`
   - 빌드 출력 디렉터리: `dist`
4. **환경 변수(Environment variables)** 두 개를 추가합니다 (1단계에서 적어 둔 값).
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = Publishable key
5. **저장 및 배포(Save and Deploy)** → 몇 분 뒤 완료되면 `https://….pages.dev` 주소가 나옵니다. 이 주소를 적어 둡니다.

## 8단계. 로그인 주소 등록

1. Supabase → **Authentication → URL Configuration**
   - **Site URL**: 7단계 주소 (예: `https://workout-dashboard.pages.dev`)
   - **Redirect URLs → Add URL**: 같은 주소 뒤에 `/**`를 붙여서 추가 (예: `https://workout-dashboard.pages.dev/**`)
   - **Save**

## 9단계. 아이폰에서 열고 확인

1. 아이폰 사파리로 7단계 주소를 엽니다 → **구글로 로그인**.
2. 처음 로그인하면 기본 운동·영양제·루틴 목록이 자동으로 들어갑니다. 체험판에 적은 기록은 그 기기 안에만 있어서 옮겨지지 않습니다.
3. 공유 버튼 → **홈 화면에 추가**.
4. 식단 탭에서 사진을 하나 올려 봅니다. **분석 중 → 확인 필요**가 나오면 모든 연결이 끝난 것입니다.

## 잘 안 될 때

| 보이는 메시지 | 확인할 곳 |
|---|---|
| 사용할 수 없는 계정이에요 | 3단계 메일 주소 철자 |
| 구글 로그인 뒤 오류 화면 또는 다시 로그인 화면 | 4단계 리디렉션 URI, 8단계 주소 |
| AI 분석이 아직 연결되지 않았어요 | 6단계 이름(`GEMINI_API_KEY`, `meal-analyze`) 철자, Verify JWT 끄기 |
| 오늘 AI 분석 무료 한도를 다 썼어요 | 정상입니다. 다음 날 다시 분석하거나 직접 적기 |
| 화면이 안 열림 | 7단계 환경 변수 두 개, 빌드 설정 |

문의하실 때는 **화면에 나온 메시지만** 알려 주세요. 키 값은 보내지 않으셔도 됩니다.

## 참고 (개발용)

- 서버 표 구조와 보안 규칙: `supabase/migrations/0001_init.sql`
- 사진 분석 기능: `supabase/functions/meal-analyze/index.ts` (다른 파일을 불러오지 않는 한 파일. 비밀값 `GEMINI_API_KEY`, 선택 `GEMINI_MODEL`)
- 화면 환경 변수: `.env.example`
- 무료 서버는 1주일 동안 쓰지 않으면 잠시 멈춥니다. 매일 쓰면 문제없고, 자동 깨우기는 배포(CI/CD) 단계에서 넣습니다.
