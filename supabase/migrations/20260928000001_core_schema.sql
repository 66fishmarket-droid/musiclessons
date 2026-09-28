-- Guitar Coach core schema (spec §5). Every user-owned table is RLS-protected on user_id = auth.uid().

create table public.skills (
  id text primary key,
  track text not null check (track in ('rhythm','fretboard','fingerstyle','fills','ear_voice','songwriting','theory')),
  level smallint not null check (level between 1 and 5),
  name text not null,
  description text not null,
  pass_metric text not null check (pass_metric in ('bpm','clean_reps','self')),
  default_target numeric,
  allowed_keys text[],
  theory_topic_id text references public.skills (id),
  styles text[]
);

create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  session_minutes smallint not null default 30 check (session_minutes in (25, 30, 40)),
  vocal_low text,
  vocal_high text,
  songwriting_weekday smallint not null default 0 check (songwriting_weekday between 0 and 6),
  style_core text[] not null default array['folk','blues','funk','soul']
);

create table public.skill_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  skill_id text not null references public.skills (id),
  status text not null default 'active' check (status in ('active','mastered')),
  score integer not null default 0,
  current_target numeric,
  last_seen date,
  last_key text,
  primary key (user_id, skill_id)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lesson_date date not null,
  template text not null,
  track text,
  skill_id text references public.skills (id),
  key text,
  style_element text,
  plan jsonb not null default '{}'::jsonb,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'planned' check (status in ('planned','completed','skipped')),
  confidence smallint check (confidence between 1 and 5),
  want_more_time boolean,
  notes text,
  llm_model text,
  prompt_version text,
  source text not null default 'app' check (source in ('app','legacy')),
  created_at timestamptz not null default now(),
  unique (user_id, lesson_date)
);

create table public.exercise_logs (
  id bigint generated always as identity primary key,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  block_index smallint not null,
  block_kind text not null,
  item_ref text,
  passed boolean,
  value_reached numeric,
  note text,
  created_at timestamptz not null default now()
);
create index exercise_logs_user_created on public.exercise_logs (user_id, created_at desc);
create index exercise_logs_lesson on public.exercise_logs (lesson_id);

create table public.review_items (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_type text not null check (item_type in ('skill','theory','style')),
  ref text not null,
  interval_days integer not null default 1,
  next_due date not null,
  last_result boolean,
  primary key (user_id, item_type, ref)
);
create index review_items_due on public.review_items (user_id, next_due);

create table public.questions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete set null,
  block_index smallint,
  question text not null,
  answer text,
  created_at timestamptz not null default now()
);
create index questions_user_created on public.questions (user_id, created_at desc);

create table public.songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  key text,
  sections jsonb not null default '[]'::jsonb,
  central_idea text,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.skills enable row level security;
create policy skills_read on public.skills for select to authenticated using (true);

do $$
declare t text;
begin
  foreach t in array array['settings','skill_progress','lessons','exercise_logs','review_items','questions','songs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_own', t);
  end loop;
end $$;
