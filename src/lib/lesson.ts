import { termsIn, type GlossaryEntry } from '../../supabase/functions/_shared/engine/glossary.ts';
import { recipeFor, type Card, type SkillRecipe } from '../../supabase/functions/_shared/engine/recipes.ts';
import type { BlockKind, LessonPlan, Skill } from '../../supabase/functions/_shared/engine/types.ts';
import type { BlockContent, LessonContent } from '../../supabase/functions/_shared/lesson/contract.ts';

/** The lessons row generate-lesson returns (the columns the app reads). */
export interface TodayLesson {
  id: string; lesson_date: string; status: 'planned' | 'completed' | 'skipped'; plan: LessonPlan; content: LessonContent;
}

export type Colour = 'gold' | 'blue' | 'pink' | 'muted' | 'teal' | 'violet' | 'saffron';

/** Display name and festival colour per block kind (UI spec §3). */
export const BLOCK_META: Record<BlockKind, { label: string; colour: Colour }> = {
  warmup: { label: 'Warm-up', colour: 'gold' },
  retest: { label: 'Cold retest', colour: 'blue' },
  new_skill: { label: 'New skill', colour: 'pink' },
  reset: { label: 'Reset', colour: 'muted' },
  review: { label: 'Review', colour: 'blue' },
  apply: { label: 'Apply', colour: 'teal' },
  create: { label: 'Create', colour: 'violet' },
  record: { label: 'Record & rate', colour: 'saffron' },
};

/** The bpm target of a block's first item, or null when the block isn't measured in bpm. */
export function bpmTarget(plan: LessonPlan, i: number): number | null {
  const t = plan.blocks[i]?.items[0]?.target;
  return t?.metric === 'bpm' ? t.target : null;
}

/** Starting metronome tempo: the item's start tempo, else its target, else the day's new-skill start, else 70. */
export function startBpm(plan: LessonPlan, i: number): number {
  const t = plan.blocks[i]?.items[0]?.target;
  if (t?.metric === 'bpm') return t.start ?? t.target ?? 70;
  const skill = plan.blocks.find(b => b.kind === 'new_skill')?.items[0]?.target;
  return skill?.metric === 'bpm' ? skill.start ?? skill.target ?? 70 : 70;
}

/** Tonic pitch class of a key name ("F#m" → "F#"). */
export function tonicOf(key: string): string {
  return /^[A-G][#b]?/.exec(key)?.[0] ?? 'C';
}

/** Readable name for a plan ref ("skill:fingerstyle.l1.giuliani_arpeggios" → "giuliani arpeggios"). */
export function refLabel(ref: string): string {
  const id = ref.slice(ref.indexOf(':') + 1);
  return (id.split('.').pop() ?? id).replaceAll('_', ' ');
}

/**
 * The block's card and recipe: Apply always plays the rhythm card; every other kind's card comes from the skill's
 * recipe, or 'none' when there is no skill (warmup/reset/review/create/record) or the skill is missing from the
 * curriculum (an old stored lesson naming a since-removed skill) — never throws.
 */
export function blockCard(kind: BlockKind, skill: Skill | undefined): { card: Card; recipe: SkillRecipe | undefined } {
  if (kind === 'apply') return { card: 'rhythm', recipe: undefined };
  const recipe = skill ? recipeFor(skill) : undefined;
  return { card: recipe?.card ?? 'none', recipe };
}

/** One block's text, reading both engine-written lessons and ones stored before them (tips/explanation). */
export function blockText(content: LessonContent, i: number): { instructions: string[]; target_text: string; listen_for: string; more: string[] } {
  const b = content.blocks[i] as (Partial<BlockContent> & { tips?: string; explanation?: string }) | undefined;
  if (!b) return { instructions: [''], target_text: '', listen_for: '', more: [] };
  const more = b.more !== undefined ? [b.more] : [b.tips ?? '', b.explanation ?? ''];
  return { instructions: b.instructions?.length ? b.instructions : [''], target_text: b.target_text ?? '', listen_for: b.listen_for ?? '', more: more.filter(Boolean) };
}

/** Glossary terms used in one block's text (steps, target, listen-for, create prompt on the create block, LLM more). */
export function blockTerms(content: LessonContent, i: number): GlossaryEntry[] {
  const t = blockText(content, i);
  const createPrompt = content.blocks[i]?.kind === 'create' ? content.create_prompt : '';
  return termsIn([...t.instructions, t.target_text, t.listen_for, createPrompt, ...t.more]);
}
