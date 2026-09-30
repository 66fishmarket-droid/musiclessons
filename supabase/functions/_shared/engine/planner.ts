import { pickCreateTask } from './create.ts';
import { nextKey } from './keys.ts';
import { buildMusic } from './music.ts';
import { RECIPES } from './recipes.ts';
import { STYLE_CATALOG, type StyleCatalog, type StyleElement } from './styles.ts';
import { buildBlocks } from './templates.ts';
import {
  TRACKS, type BlockKind, type LessonPlan, type PlanItem, type PlannerState, type Skill, type SkillProgress,
  type SkillTrack, type StyleChoice, type Target, type Track,
} from './types.ts';

const DAY = 86_400_000;
const NEVER = 10_000;

/** Whole days from `from` to `to` (ISO dates). */
export const daysBetween = (from: string, to: string): number => Math.round((Date.parse(to) - Date.parse(from)) / DAY);
/** ISO date `n` days after `date`. */
export const addDays = (date: string, n: number): string => new Date(Date.parse(date) + n * DAY).toISOString().slice(0, 10);

interface Ctx {
  progress: Map<string, SkillProgress>;
  skills: Map<string, Skill>;
  yesterday: PlannerState['recentLessons'][number] | null;
  isRepeat: boolean;
}
function context(state: PlannerState): Ctx {
  const yesterday = state.recentLessons.find(l => l.date === addDays(state.today, -1)) ?? null;
  return {
    progress: new Map(state.progress.map(p => [p.skill_id, p])),
    skills: new Map(state.skills.map(s => [s.id, s])),
    yesterday,
    isRepeat: !!(yesterday?.want_more_time && yesterday.track && yesterday.skill_id),
  };
}
const isMastered = (ctx: Ctx, id: string) => ctx.progress.get(id)?.status === 'mastered';

function trackLevel(state: PlannerState, ctx: Ctx, track: SkillTrack): number | null {
  const open = state.skills.filter(s => s.track === track && !isMastered(ctx, s.id)).map(s => s.level);
  return open.length ? Math.min(...open) : null;
}

/** Track with the highest days-since-last × (1 + recent fail rate); yesterday's track only on repeat days. */
export function pickTrack(state: PlannerState, ctx: Ctx): Track {
  if (ctx.isRepeat) return ctx.yesterday!.track!;
  const open = TRACKS.filter(t => trackLevel(state, ctx, t) !== null);
  if (open.length === 0) throw new Error('Every track is mastered');
  const pool = open.length > 1 ? open.filter(t => t !== ctx.yesterday?.track) : open;
  let best: Track = pool[0];
  let bestScore = -1;
  for (const t of pool) {
    const last = state.recentLessons.find(l => l.track === t);
    const logs = state.recentLogs.filter(l => l.track === t).slice(0, 5);
    const failRate = logs.length ? logs.filter(l => l.passed === false).length / logs.length : 0;
    const score = (last ? daysBetween(last.date, state.today) : NEVER) * (1 + failRate);
    if (score > bestScore) { best = t; bestScore = score; }
  }
  return best;
}

/** One verified style element: least-recently-used style (core ×2), a new element at most every other session. */
export function pickStyleElement(state: PlannerState, ctx: Ctx, catalog: StyleCatalog): StyleChoice | null {
  if (ctx.isRepeat && ctx.yesterday!.style_element) return { ...ctx.yesterday!.style_element, is_new: false };
  const verified = catalog.elements.filter(e => e.verified);
  if (verified.length === 0) return null;
  const seen = new Set([
    ...state.reviewItems.filter(r => r.item_type === 'style').map(r => r.ref),
    ...state.recentLessons.flatMap(l => (l.style_element ? [l.style_element.element_id] : [])),
  ]);
  const lastNew = state.recentLessons.findIndex(l => l.style_element?.is_new);
  let allowNew = lastNew === -1 || lastNew >= 1;
  const styleIds = [...new Set(verified.map(e => e.style))];
  let pool = styleIds;
  if (!allowNew) {
    pool = styleIds.filter(s => verified.some(e => e.style === s && seen.has(e.id)));
    if (pool.length === 0) { allowNew = true; pool = styleIds; }
  }
  const yStyle = ctx.yesterday?.style_element?.style;
  if (pool.length > 1 && yStyle) pool = pool.filter(s => s !== yStyle);
  let style = pool[0];
  let best = -1;
  for (const s of pool) {
    const last = state.recentLessons.find(l => l.style_element?.style === s);
    const score = (last ? daysBetween(last.date, state.today) : NEVER) * (state.settings.style_core.includes(s) ? 2 : 1);
    if (score > best) { style = s; best = score; }
  }
  const own = verified.filter(e => e.style === style);
  const fresh = own.find(e => !seen.has(e.id));
  if (allowNew && fresh) return { style, element_id: fresh.id, kind: fresh.kind, is_new: true };
  const seenOwn = own.filter(e => seen.has(e.id));
  const due = state.reviewItems
    .filter(r => r.item_type === 'style' && r.next_due <= state.today && seenOwn.some(e => e.id === r.ref))
    .sort((a, b) => a.next_due.localeCompare(b.next_due))[0];
  const lastUse = (e: StyleElement) => state.recentLessons.find(l => l.style_element?.element_id === e.id)?.date ?? '';
  const pick = (due ? seenOwn.find(e => e.id === due.ref) : [...seenOwn].sort((a, b) => lastUse(a).localeCompare(lastUse(b)))[0]) ?? fresh!;
  return { style, element_id: pick.id, kind: pick.kind, is_new: !seen.has(pick.id) };
}

/** Stalest un-mastered skill at the track's level, preferring ones tagged with today's style. */
export function pickSkill(state: PlannerState, ctx: Ctx, track: Track, style: string | null): Skill {
  if (ctx.isRepeat) return ctx.skills.get(ctx.yesterday!.skill_id!)!;
  const level = trackLevel(state, ctx, track)!;
  const candidates = state.skills.filter(s => s.track === track && s.level === level && !isMastered(ctx, s.id));
  const styled = style ? candidates.filter(s => s.styles?.includes(style)) : [];
  const seenAt = (s: Skill) => ctx.progress.get(s.id)?.last_seen ?? '';
  return [...(styled.length ? styled : candidates)].sort((a, b) => seenAt(a).localeCompare(seenAt(b)) || a.id.localeCompare(b.id))[0];
}

/** The skill's linked theory topic, else the first un-mastered theory topic. */
export function pickTheoryTopic(state: PlannerState, ctx: Ctx, skill: Skill): string | null {
  if (skill.theory_topic_id) return skill.theory_topic_id;
  return state.skills.filter(s => s.track === 'theory' && !isMastered(ctx, s.id))
    .sort((a, b) => a.level - b.level || a.id.localeCompare(b.id))[0]?.id ?? null;
}

/** Due review items, oldest first, excluding today's track and anything already in the lesson. */
export function pickReview(state: PlannerState, ctx: Ctx, track: Track, exclude: Set<string>, max = 3): LessonPlan['review'] {
  return state.reviewItems
    .filter(r => r.next_due <= state.today && !exclude.has(`${r.item_type}:${r.ref}`)
      && !(r.item_type === 'skill' && ctx.skills.get(r.ref)?.track === track))
    .sort((a, b) => a.next_due.localeCompare(b.next_due) || a.ref.localeCompare(b.ref))
    .slice(0, max)
    .map(r => ({ item_type: r.item_type, ref: r.ref }));
}

/** The skill's current target, with a tempo-ladder start at 65% for bpm skills. */
export function targetFor(skill: Skill, progress?: SkillProgress): Target {
  const target = progress?.current_target ?? skill.default_target;
  return { metric: skill.pass_metric, target, start: skill.pass_metric === 'bpm' && target ? Math.round(target * 0.65) : null };
}

/** Plans today's lesson. Pure: the same state always gives the same plan. */
export function planLesson(state: PlannerState, catalog: StyleCatalog = STYLE_CATALOG): LessonPlan {
  const ctx = context(state);
  const track = pickTrack(state, ctx);
  const style = pickStyleElement(state, ctx, catalog);
  const skill = pickSkill(state, ctx, track, style?.style ?? null);
  const lastKey = state.recentLessons.find(l => l.track === track)?.key ?? ctx.progress.get(skill.id)?.last_key ?? null;
  const key = (ctx.isRepeat && ctx.yesterday!.key) || nextKey(lastKey, skill.allowed_keys);
  const theory = pickTheoryTopic(state, ctx, skill);
  const y = ctx.yesterday;
  const retestSkill = !ctx.isRepeat && y?.status === 'completed' && y.skill_id ? ctx.skills.get(y.skill_id) : undefined;
  const retest = retestSkill ? { skill_id: retestSkill.id, target: targetFor(retestSkill, ctx.progress.get(retestSkill.id)) } : null;
  const exclude = new Set([`skill:${skill.id}`, `skill:${retest?.skill_id}`, `style:${style?.element_id}`, `theory:${theory}`]);
  const review = pickReview(state, ctx, track, exclude);
  const target = targetFor(skill, ctx.progress.get(skill.id));
  const items = (kind: BlockKind): PlanItem[] => {
    if (kind === 'new_skill') return [{ ref: `skill:${skill.id}`, target }];
    if (kind === 'retest' && retest) return [{ ref: `skill:${retest.skill_id}`, target: retest.target }];
    if (kind === 'review') return review.map(r => ({ ref: `${r.item_type}:${r.ref}`, target: null }));
    return [];
  };
  const blocks = buildBlocks(state.settings.session_minutes, { hasRetest: !!retest, hasReview: review.length > 0 })
    .map(b => ({ ...b, items: items(b.kind) }));
  const profile = style ? catalog.profiles.find(p => p.id === style.style) ?? null : null;
  const element = style ? catalog.elements.find(e => e.id === style.element_id) ?? null : null;
  const patterns = RECIPES[skill.id]?.card === 'pattern' ? RECIPES[skill.id].patterns ?? [] : [];
  const timesSeen = state.recentLessons.filter(l => l.skill_id === skill.id).length;
  const pattern_id = patterns.length ? patterns[timesSeen % patterns.length] : null;
  const create_task_id = pickCreateTask(state.today, skill.id, state.recentLessons.map(l => l.create_task_id));
  return {
    date: state.today, template: `standard_${state.settings.session_minutes}`, track, skill_id: skill.id, key,
    is_repeat: ctx.isRepeat, style_element: style, theory_topic_id: theory, retest, review, blocks,
    music: buildMusic({ key, track, style: profile, element }),
    pattern_id, create_task_id,
  };
}
