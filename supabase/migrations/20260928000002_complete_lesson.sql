-- Scoring + review scheduling (spec §6). Runs as the caller (security invoker), so RLS still applies.

create or replace function public._schedule_review(p_uid uuid, p_type text, p_ref text, p_passed boolean, p_date date)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  ladder int[] := array[1, 3, 7, 14, 30, 60];
  cur int;
  nxt int;
begin
  select interval_days into cur from public.review_items where user_id = p_uid and item_type = p_type and ref = p_ref;
  if p_passed then
    nxt := coalesce((select min(x) from unnest(ladder) x where x > coalesce(cur, 0)), 60);
  else
    nxt := 1;
  end if;
  insert into public.review_items (user_id, item_type, ref, interval_days, next_due, last_result)
  values (p_uid, p_type, p_ref, nxt, p_date + nxt, p_passed)
  on conflict (user_id, item_type, ref) do update
    set interval_days = excluded.interval_days, next_due = excluded.next_due, last_result = excluded.last_result;
end $$;

create or replace function public._score_skill(
  p_uid uuid, p_skill text, p_passed boolean, p_value numeric, p_want_more boolean, p_date date, p_key text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  s public.skills%rowtype;
  p public.skill_progress%rowtype;
  d int;
  t numeric;
  step numeric;
  floor_ numeric;
begin
  select * into s from public.skills where id = p_skill;
  if not found then return; end if;
  insert into public.skill_progress (user_id, skill_id, current_target) values (p_uid, p_skill, s.default_target)
  on conflict do nothing;
  select * into p from public.skill_progress where user_id = p_uid and skill_id = p_skill for update;
  t := coalesce(p.current_target, s.default_target);
  step := case s.pass_metric when 'bpm' then 5 when 'clean_reps' then 1 else 0 end;
  floor_ := case s.pass_metric when 'bpm' then 40 else 1 end;

  if p_want_more then
    d := -2;
  elsif p_passed then
    d := case when step > 0 and p_value is not null and p_value > t then 2 else 1 end;
    if step > 0 then t := t + step; end if;
  else
    d := -1;
    if step > 0 then t := greatest(floor_, t - step); end if;
  end if;

  p.score := p.score + d;
  if p.score >= 3 then
    p.status := 'mastered';
    p.score := 0;
    insert into public.review_items (user_id, item_type, ref, interval_days, next_due)
    values (p_uid, case s.track when 'theory' then 'theory' else 'skill' end, p_skill, 1, p_date + 1)
    on conflict do nothing;
  elsif p.score <= -3 then
    p.score := 0;
    if step > 0 then t := greatest(floor_, round(t * 0.9)); end if;
  end if;

  update public.skill_progress
     set status = p.status, score = p.score, current_target = t, last_seen = p_date, last_key = coalesce(p_key, last_key)
   where user_id = p_uid and skill_id = p_skill;
end $$;

create or replace function public.complete_lesson(
  p_lesson_id uuid, p_logs jsonb, p_confidence smallint default null, p_want_more_time boolean default false, p_notes text default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_lesson public.lessons%rowtype;
  v_log jsonb;
  v_ref text;
  v_type text;
  v_id text;
begin
  select * into v_lesson from public.lessons where id = p_lesson_id and user_id = v_uid for update;
  if not found then raise exception 'lesson not found' using errcode = 'P0002'; end if;
  if v_lesson.status = 'completed' then return; end if;  -- offline retries are no-ops

  insert into public.exercise_logs (lesson_id, user_id, block_index, block_kind, item_ref, passed, value_reached, note)
  select p_lesson_id, v_uid, (l->>'block_index')::smallint, l->>'block_kind', l->>'item_ref',
         (l->>'passed')::boolean, (l->>'value_reached')::numeric, l->>'note'
    from jsonb_array_elements(coalesce(p_logs, '[]'::jsonb)) l;

  for v_log in select * from jsonb_array_elements(coalesce(p_logs, '[]'::jsonb)) loop
    v_ref := v_log->>'item_ref';
    continue when v_ref is null or position(':' in v_ref) = 0;
    v_type := split_part(v_ref, ':', 1);
    v_id := substr(v_ref, length(v_type) + 2);
    if v_log->>'block_kind' = 'new_skill' and v_type = 'skill' then
      perform public._score_skill(v_uid, v_id, (v_log->>'passed')::boolean, (v_log->>'value_reached')::numeric,
                                  p_want_more_time, v_lesson.lesson_date, v_lesson.key);
    elsif v_log->>'block_kind' = 'review' and v_type in ('skill', 'theory', 'style') then
      perform public._schedule_review(v_uid, v_type, v_id, (v_log->>'passed')::boolean, v_lesson.lesson_date);
      if v_type = 'theory' then
        perform public._score_skill(v_uid, v_id, (v_log->>'passed')::boolean, null, false, v_lesson.lesson_date, null);
      end if;
    end if;
  end loop;

  if v_lesson.plan->>'theory_topic_id' is not null then
    insert into public.review_items (user_id, item_type, ref, interval_days, next_due)
    values (v_uid, 'theory', v_lesson.plan->>'theory_topic_id', 1, v_lesson.lesson_date + 1)
    on conflict do nothing;
  end if;
  if coalesce((v_lesson.plan->'style_element'->>'is_new')::boolean, false) then
    insert into public.review_items (user_id, item_type, ref, interval_days, next_due)
    values (v_uid, 'style', v_lesson.plan->'style_element'->>'element_id', 1, v_lesson.lesson_date + 1)
    on conflict do nothing;
  end if;

  update public.lessons
     set status = 'completed', confidence = p_confidence, want_more_time = p_want_more_time, notes = p_notes
   where id = p_lesson_id;
end $$;
