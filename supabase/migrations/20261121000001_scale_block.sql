-- Scale block (spec 2026-11-21): warm-up scale positions live in review_items as item_type 'scale'.

alter table public.review_items drop constraint review_items_item_type_check;
alter table public.review_items add constraint review_items_item_type_check
  check (item_type in ('skill','theory','style','scale'));

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
  if p_type = 'scale' then nxt := least(nxt, 14); end if;  -- mental-practice gains halve in ~2 weeks (vault Research/scales)
  insert into public.review_items (user_id, item_type, ref, interval_days, next_due, last_result)
  values (p_uid, p_type, p_ref, nxt, p_date + nxt, p_passed)
  on conflict (user_id, item_type, ref) do update
    set interval_days = excluded.interval_days, next_due = excluded.next_due, last_result = excluded.last_result;
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
    -- no pass/fail recorded (ran out of time): don't score it, except that "more time" still applies its -2
    continue when v_log->>'passed' is null and not (p_want_more_time and v_log->>'block_kind' = 'new_skill');
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
    elsif v_log->>'block_kind' = 'warmup' and v_type = 'scale' then
      perform public._schedule_review(v_uid, v_type, v_id, (v_log->>'passed')::boolean, v_lesson.lesson_date);
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

  if coalesce((v_lesson.plan->'scale_block'->>'map_is_new')::boolean, false) then
    insert into public.review_items (user_id, item_type, ref, interval_days, next_due)
    values (v_uid, 'scale', v_lesson.plan->'scale_block'->>'map', 1, v_lesson.lesson_date + 1)
    on conflict do nothing;
  end if;

  update public.lessons
     set status = 'completed', confidence = p_confidence, want_more_time = p_want_more_time, notes = p_notes
   where id = p_lesson_id;
end $$;

-- Same grants as 20260930000001: authenticated only.
revoke execute on function public._schedule_review(uuid, text, text, boolean, date) from public, anon;
revoke execute on function public.complete_lesson(uuid, jsonb, smallint, boolean, text) from public, anon;
grant execute on function public._schedule_review(uuid, text, text, boolean, date) to authenticated;
grant execute on function public.complete_lesson(uuid, jsonb, smallint, boolean, text) to authenticated;

-- One-off: learners with 5+ completed lessons saw minor pentatonic box 1 in nearly every old warm-up, so it starts as known
-- (due today: their first new warm-up retrieves it cold; a miss just puts it back in the queue). New learners start at zero.
insert into public.review_items (user_id, item_type, ref, interval_days, next_due)
select user_id, 'scale', 'minor_pent:E', 1, current_date
  from public.lessons where status = 'completed'
 group by user_id having count(*) >= 5
on conflict do nothing;
