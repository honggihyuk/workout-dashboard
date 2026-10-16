-- 운동 대시보드 데이터베이스 (docs/04-system-design.md 2-1, 5장)
-- Supabase 대시보드 → SQL Editor 에 붙여 넣고 실행합니다. 여러 번 실행해도 안전하지 않으니 처음 한 번만 실행합니다.
-- 실행 뒤 맨 아래 "허용 계정 등록"을 대표님 구글 메일로 한 번 실행해야 로그인할 수 있습니다.

-- ── 허용 계정 (대표님 구글 계정 1개) ───────────────────────────
create table public.app_config (
  key text primary key,
  value text not null
);
-- 화면에서는 읽을 수 없게 막아 둠 (정책 없음)
alter table public.app_config enable row level security;

create function public.is_allowed() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.app_config
    where key = 'allowed_email' and lower(value) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
$$;
revoke all on function public.is_allowed() from public;
grant execute on function public.is_allowed() to authenticated;

-- 다른 계정은 가입 자체를 막음
create function public.block_other_accounts() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  allowed text;
begin
  select value into allowed from public.app_config where key = 'allowed_email';
  if allowed is null or lower(coalesce(new.email, '')) <> lower(allowed) then
    raise exception '허용되지 않은 계정입니다';
  end if;
  return new;
end
$$;
create trigger block_other_accounts before insert on auth.users
  for each row execute function public.block_other_accounts();

-- ── 공통: 수정 시각 ──────────────────────────────────────────
create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end
$$;

-- ── 목록 표 ─────────────────────────────────────────────────
create table public.exercises (
  id text primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  body_part text not null check (body_part in ('가슴', '등', '하체', '어깨', '팔', '복근', '유산소')),
  equipment text not null check (equipment in ('바벨', '덤벨', '머신', '케이블', '맨몸')),
  kind text not null default 'weight' check (kind in ('weight', 'run')),
  is_custom boolean not null default false,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.routines (
  id text primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  sort_order integer not null default 1,
  kind text not null default 'weight' check (kind in ('weight', 'run')),
  target_km double precision check (target_km is null or (target_km > 0 and target_km <= 100)),
  target_pace_sec integer check (target_pace_sec is null or target_pace_sec between 120 and 1800),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.routine_items (
  id text primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine_id text not null references public.routines (id) on delete cascade,
  exercise_id text not null references public.exercises (id),
  position integer not null check (position >= 1),
  default_sets integer not null check (default_sets between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.supplements (
  id text primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  short_name text check (short_name is null or char_length(short_name) <= 20),
  schedule text not null check (schedule in ('daily', 'workout')),
  optional_on_run_only boolean not null default false,
  sort_order integer not null default 1,
  hidden boolean not null default false,
  -- 먹은 날 식단 합계에 더할 1회 양·단백질·칼로리 (쉐이크 등)
  serving_g double precision check (serving_g is null or serving_g between 0 and 500),
  protein_g double precision check (protein_g is null or protein_g between 0 and 300),
  kcal double precision check (kcal is null or kcal between 0 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── 매일 쌓이는 기록 (범위는 4차 5장 데이터 오류 범위표) ─────────
create table public.workouts (
  id text primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  routine_id text references public.routines (id) on delete set null,
  memo text check (memo is null or char_length(memo) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner, date)
);

create table public.workout_sets (
  id text primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  exercise_id text not null references public.exercises (id),
  exercise_pos integer not null check (exercise_pos >= 1),
  set_no integer not null check (set_no >= 1),
  weight_kg double precision not null check (weight_kg between 0 and 400),
  reps integer not null check (reps between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.runs (
  id text primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  distance_km double precision not null check (distance_km > 0 and distance_km <= 100),
  duration_sec integer check (duration_sec is null or duration_sec between 0 and 86400),
  memo text check (memo is null or char_length(memo) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meals (
  id text primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  slot text not null check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  eaten_at text check (eaten_at is null or eaten_at ~ '^[0-2][0-9]:[0-5][0-9]$'),
  photo_path text,
  status text not null default 'empty' check (status in ('empty', 'uploaded', 'estimated', 'confirmed', 'failed')),
  ai_menu text,
  ai_kcal double precision check (ai_kcal is null or ai_kcal between 0 and 5000),
  ai_protein_g double precision check (ai_protein_g is null or ai_protein_g between 0 and 300),
  manual_menu text check (manual_menu is null or char_length(manual_menu) <= 200),
  manual_g double precision check (manual_g is null or manual_g between 0 and 5000),
  manual_kcal double precision check (manual_kcal is null or manual_kcal between 0 and 5000),
  manual_protein_g double precision check (manual_protein_g is null or manual_protein_g between 0 and 300),
  memo text check (memo is null or char_length(memo) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner, date, slot)
);

create table public.supplement_logs (
  id text primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  supplement_id text not null references public.supplements (id),
  taken_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner, date, supplement_id)
);

create table public.conditions (
  id text primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  type text not null check (type in ('morning', 'post_workout')),
  fatigue integer check (fatigue between 1 and 5),
  sleep_quality integer check (sleep_quality between 1 and 5),
  intensity integer check (intensity between 1 and 5),
  focus integer check (focus between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner, date, type)
);

create table public.body_weights (
  id text primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  weight_kg double precision not null check (weight_kg between 30 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner, date)
);

create table public.inbody (
  id text primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  skeletal_muscle_kg double precision not null check (skeletal_muscle_kg between 5 and 100),
  body_fat_pct double precision not null check (body_fat_pct between 2 and 60),
  body_fat_kg double precision check (body_fat_kg is null or body_fat_kg between 0 and 150),
  bmr_kcal double precision check (bmr_kcal is null or bmr_kcal between 500 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner, date)
);

-- ── 날짜 찾기 색인, 수정 시각, 본인 기록만 (RLS) ───────────────
do $$
declare
  t text;
begin
  foreach t in array array['workouts', 'workout_sets', 'runs', 'meals', 'supplement_logs', 'conditions', 'body_weights', 'inbody'] loop
    execute format('create index %I on public.%I (owner, date)', t || '_owner_date', t);
  end loop;
  foreach t in array array['exercises', 'routines', 'routine_items', 'supplements', 'workouts', 'workout_sets', 'runs', 'meals', 'supplement_logs', 'conditions', 'body_weights', 'inbody'] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy owner_only on public.%I for all to authenticated '
      'using (owner = (select auth.uid()) and (select public.is_allowed())) '
      'with check (owner = (select auth.uid()) and (select public.is_allowed()))',
      t
    );
  end loop;
end
$$;

-- ── 식사 사진 보관 (비공개, 한 장 최대 2MB, JPEG) ───────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

create policy meal_photos_owner on storage.objects for all to authenticated
  using (bucket_id = 'meal-photos' and (select public.is_allowed()))
  with check (bucket_id = 'meal-photos' and (select public.is_allowed()));

-- ── 허용 계정 등록 (따로 한 번 실행) ───────────────────────────
-- insert into public.app_config (key, value) values ('allowed_email', '대표님 구글 메일 주소');
