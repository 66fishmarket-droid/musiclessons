import { reviewView, stepElements } from '../../src/lib/lesson.ts';
import { describe, expect, it } from 'vitest';
import { buildMusic } from '../../supabase/functions/_shared/engine/music.ts';
import { planLesson, targetFor } from '../../supabase/functions/_shared/engine/planner.ts';
import { rhythmCounts, rhythmPattern } from '../../supabase/functions/_shared/engine/patterns.ts';
import { RECIPES } from '../../supabase/functions/_shared/engine/recipes.ts';
import { romanToChords } from '../../supabase/functions/_shared/engine/roman.ts';
import { elementsOf, STYLE_CATALOG } from '../../supabase/functions/_shared/engine/styles.ts';
import type { LessonPlan } from '../../supabase/functions/_shared/engine/types.ts';
import { APPLY_DEFAULT_GRID, buildSteps } from '../../supabase/functions/_shared/lesson/steps.ts';
import { SKILLS } from '../../supabase/seed/curriculum.ts';
import { PLAN, SKILL_MAP, newUserState } from './fixtures.ts';

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
    expect(review.instructions[1]).toBe(`${pattern.name}: ${expectedCounts}. Play it through ${plan.music.progression.chords.map(c => `{${c}}`).join(' ')}, one chord per bar.`);
    expect(review.rhythms).toEqual([null, { name: pattern.name, grid: pattern.grid }, null]);
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
  it('gives a rhythm skill on review what it is, the counts to strum, and the chords (owner hit bare one-liners 2026-10-05)', () => {
    const plan = { ...PLAN, blocks: [{ kind: 'review' as const, minutes: 5, items: [{ ref: 'skill:rhythm.l1.locked_8ths', target: null }] }] };
    const [line] = buildSteps(plan, SKILL_MAP).blocks[0].instructions;
    expect(line).toMatch(/^Locked 8ths and 16ths: Keep your pick hand swinging/);
    expect(line).toContain(`Strum {${plan.music.progression.chords[0]}}: 1 strum down · 1e strum up`);
    expect(line).toContain('Then once through');
  });
  it('gives a theory review item a concrete task in the key of the day, not a bare "Review: topic"', () => {
    const plan = {
      ...PLAN, key: 'G',
      blocks: [{ kind: 'review' as const, minutes: 5, items: [{ ref: 'theory:theory.l1.circle_of_fifths', target: null }] }],
    };
    const [review] = buildSteps(plan, SKILL_MAP).blocks;
    expect(review.instructions[0]).toMatch(/^Circle of fifths: /);
    expect(review.instructions[0]).toContain('G, C, D');
    expect(review.instructions[0]).not.toMatch(/^Review:/);
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
  it('never throws for every practice skill × a few keys × (no style + one element per style profile), with retest and review present', () => {
    const KEYS = ['C', 'G', 'F', 'Bb', 'E', 'Ab'];
    const practice = SKILLS.filter(s => s.track !== 'theory');
    const retestSkill = SKILLS.find(s => s.id === 'rhythm.l1.locked_8ths')!;
    const reviewSkill = SKILLS.find(s => s.id === 'fills.l1.sus_add_hammers')!;
    const theoryTopic = SKILLS.find(s => s.track === 'theory')!;
    const styleChoices = [
      { profile: null, element: null },
      ...STYLE_CATALOG.profiles.map(p => ({ profile: p, element: elementsOf(p)[0] })),
    ];
    for (const { profile, element } of styleChoices) {
      for (const key of KEYS) {
        const music = buildMusic({ key, track: 'rhythm', style: profile, element });
        const reviewItems = [
          { ref: `skill:${reviewSkill.id}`, target: null },
          { ref: `theory:${theoryTopic.id}`, target: null },
          ...(element ? [{ ref: `style:${element.id}`, target: null }] : []),
        ];
        for (const skill of practice) {
          const plan: LessonPlan = {
            ...PLAN, key, skill_id: skill.id, music,
            style_element: element ? { style: profile!.id, element_id: element.id, kind: element.kind, is_new: false } : null,
            retest: { skill_id: retestSkill.id, target: targetFor(retestSkill) },
            review: reviewItems.map(({ ref }) => ({ item_type: ref.slice(0, ref.indexOf(':')) as 'skill' | 'theory' | 'style', ref: ref.slice(ref.indexOf(':') + 1) })),
            blocks: [
              { kind: 'retest', minutes: 2, items: [{ ref: `skill:${retestSkill.id}`, target: targetFor(retestSkill) }] },
              { kind: 'new_skill', minutes: 10, items: [{ ref: `skill:${skill.id}`, target: targetFor(skill) }] },
              { kind: 'review', minutes: 5, items: reviewItems },
            ],
          };
          expect(() => buildSteps(plan, SKILL_MAP), `${skill.id} ${key} ${profile?.id ?? 'none'}`).not.toThrow();
        }
      }
    }
  });
});

describe('per-step elements line up with the engine-written steps', () => {
  it('gives every block of a real lesson a per-step list of the right length (review/reset excepted)', () => {
    const { blocks } = buildSteps(PLAN, SKILL_MAP);
    PLAN.blocks.forEach((b, i) => {
      if (b.kind === 'review' || b.kind === 'reset') return;
      const skillId = b.kind === 'retest' ? PLAN.retest?.skill_id : PLAN.skill_id;
      const recipe = skillId ? RECIPES[skillId] : undefined;
      const n = blocks[i].instructions.length;
      expect(stepElements(recipe, b.kind, 0, n, PLAN.create_task_id), `${b.kind} (${n} steps)`).not.toBeNull();
    });
  });
});

describe('review steps show their tools (owner hit text-only review 2026-10-05)', () => {
  // Every practice skill and every style rhythm, one review item each: a step that names something to play must put
  // that thing on screen, the same card the item had when it was new.
  const items = [
    ...SKILLS.filter(sk => RECIPES[sk.id]).map(sk => `skill:${sk.id}`),
    ...STYLE_CATALOG.elements.filter(e => e.kind === 'rhythm').map(e => `style:${e.id}`),
  ];
  const plan = { ...PLAN, blocks: [{ kind: 'review' as const, minutes: 5, items: items.map(ref => ({ ref, target: null })) }] };
  const [block] = buildSteps(plan, SKILL_MAP).blocks;
  const content = { blocks: [{ ...block, more: '' }] } as unknown as Parameters<typeof reviewView>[1];
  it('writes one step per item', () => expect(block.instructions).toHaveLength(items.length));
  it.each(items.map((ref, k) => [ref, k] as const))('%s shows its card, and chords when it says to play through them', (ref, k) => {
    const v = reviewView(plan, content, 0, k, SKILL_MAP);
    if (v.card !== 'none') expect(v.els, block.instructions[k]).toContain(v.card === 'chords' ? 'chords' : 'card');
    if (/\{[A-G]/.test(block.instructions[k]) && ['rhythm', 'pattern', 'chords'].includes(v.card)) expect(v.els).toContain('chords');
    if (ref.startsWith('style:')) expect(v.card).toBe('rhythm');
  });
});

