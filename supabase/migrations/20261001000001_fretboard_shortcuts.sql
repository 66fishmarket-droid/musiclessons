-- Fretboard shortcuts (spec 2026-10-01): 4 new skills, 4 reworded. Upsert only; never touches skill_progress.
insert into public.skills (id, track, level, name, description, pass_metric, default_target, allowed_keys, theory_topic_id, styles) values
  ('fretboard.l1.notes_e_a', 'fretboard', 1, 'Notes on strings 6 and 5', 'Landmark frets 3-5-7-9-12, then name any note on the low E and A strings instantly.', 'clean_reps', 3, null, 'theory.l1.degrees', null),
  ('fretboard.l1.b_string_rule', 'fretboard', 1, 'The B-string rule', 'Strings are 5 frets apart except G to B (4): why, and how it shifts every shape.', 'clean_reps', 3, null, 'theory.l1.intervals', null),
  ('fretboard.l1.octave_shapes', 'fretboard', 1, 'Octave shapes', 'Find every octave of a note: skip one string up 2, skip two back 3, plus the B-string shift.', 'clean_reps', 3, null, 'theory.l1.intervals', null),
  ('fretboard.l2.interval_shapes', 'fretboard', 2, 'Interval shapes', 'Where the 3rd, 5th, b7 and octave sit from any root on strings 6 and 5.', 'clean_reps', 3, null, 'theory.l1.intervals', null),
  ('fretboard.l2.caged_linked', 'fretboard', 2, 'CAGED shapes linked', 'Play one chord in all five CAGED shapes up the neck, naming the root in each.', 'clean_reps', 3, null, null, null),
  ('fretboard.l2.pentatonic_per_shape', 'fretboard', 2, 'Pentatonic per CAGED shape', 'Box 1 first, then the pentatonic box that sits around each CAGED shape.', 'bpm', 70, null, 'theory.l1.scale_construction', null),
  ('fretboard.l2.progression_grid', 'fretboard', 2, 'The progression grid', 'I-IV-V-vi as one movable grid of roots on strings 6 and 5, by number.', 'bpm', 60, null, 'theory.l2.diatonic_qualities', null),
  ('fretboard.l4.one_string_scale', 'fretboard', 4, 'Scales on one string', 'The key''s scale along a single string, counting whole and half steps.', 'bpm', 70, null, 'theory.l1.scale_construction', null)
on conflict (id) do update set track = excluded.track, level = excluded.level, name = excluded.name,
  description = excluded.description, pass_metric = excluded.pass_metric, default_target = excluded.default_target,
  allowed_keys = excluded.allowed_keys, theory_topic_id = excluded.theory_topic_id, styles = excluded.styles;
