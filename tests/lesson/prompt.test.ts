import { describe, expect, it } from 'vitest';
import { planLesson } from '../../supabase/functions/_shared/engine/planner.ts';
import { STYLE_CATALOG } from '../../supabase/functions/_shared/engine/styles.ts';
import { PROMPT_VERSION, SYSTEM_PROMPT, buildMessages } from '../../supabase/functions/_shared/lesson/prompt.ts';
import { PLAN, SKILL_MAP, newUserState } from './fixtures.ts';
import { NOTE_CALLER_SKILLS } from '../../src/lib/noteCaller.ts';

const briefOf = (content: string) => JSON.parse(content.slice(content.indexOf('\n') + 1));
const settings = { ...newUserState().settings, vocal_low: 'A2', vocal_high: 'E4' };

describe('buildMessages', () => {
  const msgs = buildMessages({
    plan: PLAN, skills: SKILL_MAP, style: null, settings,
    recent: Array.from({ length: 9 }, (_, i) => `lesson ${i}`), questions: Array.from({ length: 12 }, (_, i) => `question ${i}`),
  });
  const brief = briefOf(msgs[1].content);

  it('sends the fixed system prompt first', () => {
    expect(msgs[0]).toEqual({ role: 'system', content: SYSTEM_PROMPT });
    expect(msgs[1].content.startsWith("Write today's lesson for this plan:\n")).toBe(true);
    expect(PROMPT_VERSION).toMatch(/^gc-\d{4}-\d{2}-\d{2}[a-z]?$/);
    expect(SYSTEM_PROMPT).toMatch(/reset: exactly one instruction/);
    expect(SYSTEM_PROMPT).toMatch(/Plain words: the learner is a beginner/);
    expect(SYSTEM_PROMPT).toMatch(/App tools: mention only these/);
    for (const id of NOTE_CALLER_SKILLS) expect(SYSTEM_PROMPT).toContain(id);
    expect(SYSTEM_PROMPT).toMatch(/The create block's instructions are a recipe/);
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
  });
  it('caps history at 7 lessons and 10 questions', () => {
    expect(brief.recent_lessons).toHaveLength(7);
    expect(brief.recent_questions).toHaveLength(10);
  });
  it('names today\'s style element', () => {
    const plan = planLesson(newUserState(), STYLE_CATALOG);
    const style = STYLE_CATALOG.profiles.find(p => p.id === plan.style_element!.style)!;
    const b = briefOf(buildMessages({ plan, skills: SKILL_MAP, style, settings, recent: [], questions: [] })[1].content);
    expect(b.style).toMatchObject({ name: style.name, element: { kind: plan.style_element!.kind, is_new: true } });
    expect(b.style.element.name).toBeTruthy();
  });
});
