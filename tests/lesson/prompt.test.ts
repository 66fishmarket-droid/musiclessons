import { describe, expect, it } from 'vitest';
import { planLesson } from '../../supabase/functions/_shared/engine/planner.ts';
import { STYLE_CATALOG } from '../../supabase/functions/_shared/engine/styles.ts';
import { PROMPT_VERSION, SYSTEM_PROMPT, buildMessages } from '../../supabase/functions/_shared/lesson/prompt.ts';
import { FUNK_PLAN, PLAN, SKILL_MAP, newUserState } from './fixtures.ts';
import { rhythmCounts, rhythmPattern } from '../../supabase/functions/_shared/engine/patterns.ts';

const briefOf = (content: string) => JSON.parse(content.slice(content.indexOf('\n') + 1));
const settings = { ...newUserState().settings, vocal_low: 'A2', vocal_high: 'E4' };

describe('buildMessages', () => {
  const msgs = buildMessages({
    plan: PLAN, skills: SKILL_MAP, style: null, settings,
    recent: Array.from({ length: 9 }, (_, i) => `lesson ${i}`), questions: Array.from({ length: 12 }, (_, i) => `question ${i}`), metSkills: [],
  });
  const brief = briefOf(msgs[1].content);

  it('gives the model the lesson path and each block intro and bridge, so more does not repeat them', () => {
    const funk = STYLE_CATALOG.profiles.find(p => p.id === 'funk')!;
    const b = briefOf(buildMessages({ plan: FUNK_PLAN, skills: SKILL_MAP, style: funk, settings, recent: [], questions: [], metSkills: [] })[1].content);
    expect(b.path[0]).toContain('G dorian →');
    expect(b.steps.find((s: { kind: string }) => s.kind === 'apply')).toMatchObject({ bridge: expect.stringContaining('Same G dorian notes') });
    expect(SYSTEM_PROMPT).toContain('intro and bridge');
  });
  it('sends the fixed system prompt first', () => {
    expect(msgs[0]).toEqual({ role: 'system', content: SYSTEM_PROMPT });
    expect(msgs[1].content.startsWith("Add colour to today's lesson. Plan and fixed steps:\n")).toBe(true);
    expect(PROMPT_VERSION).toMatch(/^gc-\d{4}-\d{2}-\d{2}[a-z]?$/);
    expect(PROMPT_VERSION).toBe('gc-2026-10-07');
    expect(SYSTEM_PROMPT).toMatch(/do not restate or contradict/);
    expect(SYSTEM_PROMPT).not.toMatch(/instructions: 2 to 5/);
    expect(SYSTEM_PROMPT).not.toMatch(/App tools:/);
  });
  it('briefs the plan: skill, theory topic, key, chords and blocks in order', () => {
    expect(brief).toMatchObject({
      key: 'G', track: 'rhythm', session: 'standard_30', is_repeat: false, style: null, vocal_range: 'A2–E4',
      skill: { id: PLAN.skill_id, name: SKILL_MAP.get(PLAN.skill_id)!.name },
      theory_topic: { id: PLAN.theory_topic_id }, allowed_chords: ['G', 'C', 'D'],
      music: { scale: 'G major', progression: { roman: ['I', 'IV', 'V', 'I'], chords: ['G', 'C', 'D', 'G'] } },
    });
    expect(brief.blocks.map((b: { kind: string }) => b.kind)).toEqual(PLAN.blocks.map(b => b.kind));
    expect(brief.blocks.find((b: { kind: string }) => b.kind === 'new_skill').items[0].target).toEqual({ metric: 'bpm', target: 70, start: 46 });
    expect(brief.steps).toHaveLength(PLAN.blocks.length);
    expect(brief.met_skills).toEqual([SKILL_MAP.get(PLAN.skill_id)!.name]);
  });
  it('keeps the rhythm counts in the music block', () => {
    expect(brief.picking_pattern).toBeUndefined();
    expect(brief.music.rhythm_counts).toBe(PLAN.music.rhythm ? rhythmCounts(rhythmPattern(PLAN.music.rhythm.name, PLAN.music.rhythm.grid)) : null);
  });
  it('caps history at 7 lessons and 10 questions', () => {
    expect(brief.recent_lessons).toHaveLength(7);
    expect(brief.recent_questions).toHaveLength(10);
  });
  it('lists avoid_names: non-theory skills neither met nor already named in the steps text', () => {
    expect(brief.avoid_names).not.toContain(SKILL_MAP.get(PLAN.skill_id)!.name);
    expect(brief.avoid_names).toContain('Travis picking'); // fingerstyle.l3.travis_basic: not met, not in today's rhythm steps
    const stepsBlob = brief.steps
      .flatMap((b: { instructions: string[]; listen_for: string }) => [...b.instructions, b.listen_for]).join(' ').toLowerCase();
    for (const name of brief.avoid_names as string[]) expect(stepsBlob).not.toContain(name.toLowerCase());
  });
  it('names today\'s style element', () => {
    const plan = planLesson(newUserState(), STYLE_CATALOG);
    const style = STYLE_CATALOG.profiles.find(p => p.id === plan.style_element!.style)!;
    const b = briefOf(buildMessages({ plan, skills: SKILL_MAP, style, settings, recent: [], questions: [], metSkills: [] })[1].content);
    expect(b.style).toMatchObject({ name: style.name, element: { kind: plan.style_element!.kind, is_new: true } });
    expect(b.style.element.name).toBeTruthy();
  });
});
