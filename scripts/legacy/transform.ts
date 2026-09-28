import { SKILLS } from '../../supabase/seed/curriculum.ts';

export type Row = Record<string, string>;
export interface Report {
  lessons: number; duplicatesDropped: string[]; repaired: string[]; unparseable: string[];
  unmappedSubfocus: string[]; feedbackFilled: number; progress: number; mastered: number;
}
export interface LessonRow {
  lesson_date: string; template: 'legacy'; track: string | null; skill_id: string | null; key: string | null;
  status: 'completed' | 'skipped'; confidence: number | null; want_more_time: boolean | null; notes: string | null;
  llm_model: string; prompt_version: string | null; source: 'legacy'; plan: Record<string, never>;
  content: { legacy: Record<string, string | null> };
}
export interface ProgressRow { skill_id: string; status: 'active' | 'mastered'; score: 0; current_target: null; last_seen: string | null; last_key: null }
export interface ReviewRow { item_type: 'skill' | 'theory'; ref: string; interval_days: number; next_due: string }

/** An empty import report. */
export const newReport = (): Report => ({
  lessons: 0, duplicatesDropped: [], repaired: [], unparseable: [], unmappedSubfocus: [], feedbackFilled: 0, progress: 0, mastered: 0,
});
/** Lower-case, dash-normalised, punctuation-free key for matching sheet names. */
export const normalize = (s: string): string =>
  s.trim().toLowerCase().replace(/[–—]/g, '-').replace(/♭/g, 'b').replace(/[^a-z0-9\- ]/g, '').replace(/\s+/g, ' ');

const entry = (focus: string, sub: string, skill: string): [string, string] => [`${normalize(focus)}|${normalize(sub)}`, skill];
/** Old Make Focus|SubFocus → new skill id (catalog in legacy/make/spec/domain/subfocus_catalog.md). */
export const SUBFOCUS_MAP: Record<string, string> = Object.fromEntries([
  entry('Theory', 'Circle of Fifths', 'theory.l1.circle_of_fifths'), entry('Theory', 'Intervals', 'theory.l1.intervals'),
  entry('Theory', 'Functional Harmony', 'theory.l2.diatonic_qualities'), entry('Theory', 'Cadences', 'theory.l2.diatonic_qualities'),
  entry('Theory', 'Voice Leading', 'fretboard.l4.voice_leading_inversions'), entry('Theory', 'Voice Leading (theory)', 'fretboard.l4.voice_leading_inversions'),
  entry('CAGED', 'Shapes overview', 'fretboard.l2.caged_linked'), entry('CAGED', 'Root finder', 'fretboard.l1.notes_e_a'),
  entry('CAGED', 'Triads (strings 1–3)', 'fretboard.l3.triads_321'), entry('CAGED', 'Triads (strings 2–4)', 'fretboard.l3.triads_432'),
  entry('CAGED', 'Linking shapes', 'fretboard.l2.caged_linked'), entry('CAGED', 'Voice leading between shapes', 'fretboard.l4.voice_leading_inversions'),
  entry('Extensions', 'Sus & add', 'theory.l3.sus_add'), entry('Extensions', 'Seventh chords (maj7/min7/dom7)', 'theory.l3.sevenths'),
  entry('Extensions', '6ths & 9ths (shell voicings)', 'fretboard.l5.seventh_shells'), entry('Extensions', '7sus4 & add9 embellishments', 'fills.l1.sus_add_hammers'),
  entry('Groove', 'Strum basics', 'rhythm.l1.locked_8ths'), entry('Groove', 'Accent patterns (backbeat/anticipations)', 'rhythm.l1.accents_palm_mute'),
  entry('Groove', '16ths with muting', 'rhythm.l2.ghost_strums'), entry('Groove', 'Shuffle/swing feel', 'rhythm.l3.shuffle_68'),
  entry('Groove', 'Metronome subdivisions', 'rhythm.l3.anticipations'),
  entry('Progressions', 'I–IV–V', 'songwriting.l1.core_loops'), entry('Progressions', 'I–V–vi–IV', 'songwriting.l1.core_loops'),
  entry('Progressions', 'ii–V–I', 'theory.l3.sevenths'), entry('Progressions', 'Turnarounds', 'fills.l2.bass_walks'),
  entry('Progressions', 'Modal interchange (iv, ♭VII)', 'songwriting.l3.borrowed_colour'),
  entry('Ear', 'Intervals (sing/play)', 'ear_voice.l1.sing_135'), entry('Ear', 'Chord quality ID (maj/min/dom)', 'ear_voice.l2.sing_roots'),
  entry('Ear', 'Cadence recognition', 'ear_voice.l4.borrowed_chords_by_ear'), entry('Ear', 'Call & response rhythm', 'rhythm.l3.anticipations'),
  entry('Creative', 'Rhythmic displacement', 'rhythm.l3.anticipations'), entry('Creative', 'Pedal tones / drones', 'fills.l1.open_chord_pulloffs'),
  entry('Creative', 'Ostinato riffs', 'fills.l5.fill_in_context'), entry('Creative', 'Chord-melody starter', 'fingerstyle.l5.melody_over_thumb'),
]);
const TRACK_OF = new Map(SKILLS.map(s => [s.id, s.track]));
const STATUS_WORDS = new Set(['completed', 'delivered', 'skipped']);
/** Value of the first column whose header contains `fragment` (Form headers carry stray whitespace). */
const col = (row: Row, fragment: string) => Object.entries(row).find(([k]) => k.toLowerCase().includes(fragment))?.[1]?.trim() ?? '';
const conf = (v: string) => (/^[1-5]$/.test(v.trim()) ? Number(v) : null);
const yesNo = (v: string) => (/^(yes|true)$/i.test(v.trim()) ? true : /^(no|false)$/i.test(v.trim()) ? false : null);
function skillFor(focus: string, sub: string, report: Report): string | null {
  const skill = SUBFOCUS_MAP[`${normalize(focus)}|${normalize(sub)}`];
  if (!skill && sub.trim()) {
    const label = `${focus}|${sub}`;
    if (!report.unmappedSubfocus.includes(label)) report.unmappedSubfocus.push(label);
  }
  return skill ?? null;
}

/** Legacy Lessons rows → lessons table rows: repairs shifted columns, drops same-date duplicates, fills feedback. */
export function transformLessons(lessons: Row[], feedback: Row[], report: Report): LessonRow[] {
  const byDate = new Map<string, { row: Row; out: LessonRow }>();
  lessons.forEach((row, i) => {
    const date = (row.Date ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { report.unparseable.push(`row ${i + 2}: date "${row.Date}"`); return; }
    const legacy: Record<string, string | null> = { ...row };
    if (STATUS_WORDS.has((row.JamPrompt ?? '').trim().toLowerCase())) {
      legacy.JamPrompt = null; report.repaired.push(`${date}: JamPrompt held a status`);
    }
    let confidence = conf(row.Feedback_Confidence ?? '');
    let wantMore = yesNo(row.Feedback_NeedReinforce ?? '');
    if (confidence === null && conf(row.Feedback_NeedReinforce ?? '') !== null) {
      confidence = conf(row.Feedback_NeedReinforce); wantMore = null; report.repaired.push(`${date}: confidence was in NeedReinforce`);
    }
    let notes = row.Feedback_Notes?.trim() || null;
    if (confidence === null) {
      const uid = row.LessonUID?.trim();
      const byUid = uid ? feedback.filter(f => f.LessonUID?.trim() === uid) : [];
      const matches = byUid.length ? byUid : feedback.filter(f => (f.Timestamp ?? '').slice(0, 10) === date);
      if (matches.length === 1) {
        const f = matches[0];
        confidence = conf(col(f, 'confident'));
        wantMore = yesNo(col(f, 'more time'));
        notes = notes ?? (col(f, 'notes') || null);
        report.feedbackFilled++;
      }
    }
    const skill = skillFor(row.FocusArea ?? '', row.SubFocus ?? '', report);
    const out: LessonRow = {
      lesson_date: date, template: 'legacy', track: skill ? TRACK_OF.get(skill) ?? null : null, skill_id: skill,
      key: row.Key?.trim() || null, status: row.Status?.trim().toLowerCase() === 'completed' ? 'completed' : 'skipped',
      confidence, want_more_time: wantMore, notes, llm_model: 'gpt-4.1', prompt_version: row.PromptVersion?.trim() || null,
      source: 'legacy', plan: {}, content: { legacy },
    };
    const prev = byDate.get(date);
    if (prev && (prev.row.GeneratedAt ?? '') > (row.GeneratedAt ?? '')) {
      report.duplicatesDropped.push(`${date}: ${row.Title}`); return;
    }
    if (prev) report.duplicatesDropped.push(`${date}: ${prev.row.Title}`);
    byDate.set(date, { row, out });
  });
  const rows = [...byDate.values()].map(v => v.out).sort((a, b) => a.lesson_date.localeCompare(b.lesson_date));
  report.lessons = rows.length;
  return rows;
}

/** SubFocusProgress rows → skill_progress (max tier per skill; tier ≥ 3 mastered) plus review rows for mastered skills. */
export function transformProgress(rows: Row[], report: Report, today: string): { progress: ProgressRow[]; reviews: ReviewRow[] } {
  const best = new Map<string, { tier: number; lastSeen: string | null }>();
  for (const r of rows) {
    const skill = skillFor(r.Focus ?? '', r.Subfocus ?? r.SubFocus ?? '', report);
    if (!skill) continue;
    const tier = Number(r.Tier) || 1;
    const lastSeen = /^\d{4}-\d{2}-\d{2}/.test(r.LastSeen ?? '') ? r.LastSeen.slice(0, 10) : null;
    const prev = best.get(skill);
    best.set(skill, {
      tier: Math.max(prev?.tier ?? 0, tier),
      lastSeen: [prev?.lastSeen, lastSeen].filter(Boolean).sort().pop() ?? null,
    });
  }
  const tomorrow = new Date(Date.parse(today) + 86_400_000).toISOString().slice(0, 10);
  const progress: ProgressRow[] = [...best].sort(([a], [b]) => a.localeCompare(b)).map(([skill_id, v]) => ({
    skill_id, status: v.tier >= 3 ? 'mastered' : 'active', score: 0, current_target: null, last_seen: v.lastSeen, last_key: null,
  }));
  const reviews: ReviewRow[] = progress.filter(p => p.status === 'mastered').map(p => ({
    item_type: TRACK_OF.get(p.skill_id) === 'theory' ? 'theory' : 'skill', ref: p.skill_id, interval_days: 7, next_due: tomorrow,
  }));
  report.progress = progress.length;
  report.mastered = reviews.length;
  return { progress, reviews };
}
