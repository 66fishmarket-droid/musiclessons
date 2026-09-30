import { describe, expect, it } from 'vitest';
import { planLesson } from '../../supabase/functions/_shared/engine/planner.ts';
import { rhythmCounts, rhythmPattern } from '../../supabase/functions/_shared/engine/patterns.ts';
import { RECIPES } from '../../supabase/functions/_shared/engine/recipes.ts';
import { romanToChords } from '../../supabase/functions/_shared/engine/roman.ts';
import { STYLE_CATALOG } from '../../supabase/functions/_shared/engine/styles.ts';
import { APPLY_DEFAULT_GRID, buildSteps } from '../../supabase/functions/_shared/lesson/steps.ts';
import { SKILLS } from '../../supabase/seed/curriculum.ts';
import { NO_STYLES, PLAN, SKILL_MAP, newUserState } from './fixtures.ts';

describe('buildSteps', () => {
  it('writes one block per plan block, same kinds, every block with at least one step', () => {
    const { blocks } = buildSteps(PLAN, SKILL_MAP);
    expect(blocks.map(b => b.kind)).toEqual(PLAN.blocks.map(b => b.kind));
    for (const b of blocks) expect(b.instructions.length, b.kind).toBeGreaterThan(0);
  });
  it('writes Apply from the rhythm counts and the chords', () => {
    const plan = planLesson(newUserState(), STYLE_CATALOG);
    const apply = buildSteps(plan, SKILL_MAP).blocks.find(b => b.kind === 'apply')!;
    expect(apply.instructions[0]).toContain(plan.music.rhythm!.name);
    expect(apply.instructions.join(' ')).toContain(`{${plan.music.progression.chords[0]}}`);
  });
  it('falls back to steady down-strums on Apply when the day has no style rhythm', () => {
    const noRhythm = { ...PLAN, music: { ...PLAN.music, rhythm: null } };
    const apply = buildSteps(noRhythm, SKILL_MAP).blocks.find(b => b.kind === 'apply')!;
    expect(apply.instructions[0]).toBe('Steady down-strums: 1 strum down · 2 strum down · 3 strum down · 4 strum down');
    expect(APPLY_DEFAULT_GRID).toBe('D---D---D---D---');
  });
  it('describes today\'s pattern on new_skill and the skill\'s first pattern on a retest', () => {
    const pinch = SKILLS.find(s => s.id === 'fingerstyle.l1.pima_pinches')!;
    const plan = {
      ...PLAN, skill_id: pinch.id, pattern_id: 'giuliani_pima',
      retest: { skill_id: pinch.id, target: { metric: 'bpm' as const, start: 39, target: 60 } },
      blocks: [
        { kind: 'retest' as const, minutes: 2, items: [{ ref: `skill:${pinch.id}`, target: { metric: 'bpm' as const, start: 39, target: 60 } }] },
        { kind: 'new_skill' as const, minutes: 10, items: [{ ref: `skill:${pinch.id}`, target: { metric: 'bpm' as const, start: 39, target: 60 } }] },
      ],
    };
    const [retest, newSkill] = buildSteps(plan, SKILL_MAP).blocks;
    expect(newSkill.instructions.join(' ')).toContain('p-i-m-a');
    expect(retest.instructions.join(' ')).toContain('Pinch and pluck');
    expect(newSkill.listen_for).toMatch(/pinch/);
  });
  it('uses the planned Create task for the Create block and create_prompt', () => {
    const { blocks, create_prompt } = buildSteps({ ...PLAN, create_task_id: 'rhyming_couplet' }, SKILL_MAP);
    expect(create_prompt).toMatch(/rhyming lines/);
    expect(blocks.find(b => b.kind === 'create')!.instructions[0]).toMatch(/pick one object/);
  });
  it('spells out a skill step, a style rhythm\'s counts, and a style progression\'s chords on review', () => {
    // A skill whose recipe doesn't need a target, since real review items carry target: null.
    const skill = SKILLS.find(s => s.id === 'fingerstyle.l4.sing_over_pattern')!;
    const rhythmEl = STYLE_CATALOG.elements.find(e => e.kind === 'rhythm')!;
    const progEl = STYLE_CATALOG.elements.find(e => e.kind === 'progression')!;
    const plan = {
      ...PLAN,
      blocks: [{
        kind: 'review' as const, minutes: 5,
        items: [
          { ref: `skill:${skill.id}`, target: null },
          { ref: `style:${rhythmEl.id}`, target: null },
          { ref: `style:${progEl.id}`, target: null },
        ],
      }],
    };
    const [review] = buildSteps(plan, SKILL_MAP).blocks;

    const rhythmProfile = STYLE_CATALOG.profiles.find(p => p.id === rhythmEl.style)!;
    const pattern = rhythmProfile.rhythm_patterns.find(p => p.id === rhythmEl.id)!;
    const expectedCounts = rhythmCounts(rhythmPattern(pattern.name, pattern.grid));

    const progProfile = STYLE_CATALOG.profiles.find(p => p.id === progEl.style)!;
    const prog = progProfile.progressions.find(p => p.id === progEl.id)!;
    const chords = romanToChords(plan.key, prog.roman);

    expect(review.instructions[0]).toContain(skill.name);
    expect(review.instructions[1]).toBe(`${pattern.name}: ${expectedCounts}`);
    for (const c of chords) expect(review.instructions[2]).toContain(`{${c}}`);
  });
  it('review renders only the first recipe step, so a bpm-ladder skill with a null target doesn\'t throw', () => {
    const skill = SKILLS.find(s => s.id === 'fingerstyle.l1.giuliani_arpeggios')!;
    const plan = {
      ...PLAN,
      blocks: [{ kind: 'review' as const, minutes: 5, items: [{ ref: `skill:${skill.id}`, target: null }] }],
    };
    const [review] = buildSteps(plan, SKILL_MAP).blocks;
    expect(review.instructions[0].startsWith(skill.name)).toBe(true);
  });
  it('builds a review item for every RECIPES skill with a null target without throwing', () => {
    for (const id of Object.keys(RECIPES)) {
      const plan = {
        ...PLAN,
        blocks: [{ kind: 'review' as const, minutes: 5, items: [{ ref: `skill:${id}`, target: null }] }],
      };
      expect(() => buildSteps(plan, SKILL_MAP), id).not.toThrow();
    }
  });
  it('builds for every non-theory skill as today\'s skill without throwing', () => {
    for (const s of SKILLS.filter(x => x.track !== 'theory')) {
      const plan = planLesson(newUserState({ skills: [s, ...SKILLS.filter(x => x.track === 'theory')] }), NO_STYLES);
      expect(() => buildSteps({ ...plan, skill_id: s.id }, SKILL_MAP), s.id).not.toThrow();
    }
  });
});
