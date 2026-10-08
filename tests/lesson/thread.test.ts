import { describe, expect, it } from 'vitest';
import { buildMusic } from '../../supabase/functions/_shared/engine/music.ts';
import { targetFor } from '../../supabase/functions/_shared/engine/planner.ts';
import { elementsOf, STYLE_CATALOG } from '../../supabase/functions/_shared/engine/styles.ts';
import { GLOSSARY } from '../../supabase/functions/_shared/engine/glossary.ts';
import type { LessonPlan } from '../../supabase/functions/_shared/engine/types.ts';
import { lessonThread, shortStyleName } from '../../supabase/functions/_shared/lesson/thread.ts';
import { SKILLS } from '../../supabase/seed/curriculum.ts';
import { FUNK_PLAN, PLAN, SKILL_MAP } from './fixtures.ts';

const BRIDGE = /^(Change of focus: |Same |Part of today's )/;

describe('lessonThread', () => {
  it('links the funk day: Dorian is funk\'s scale, so Apply plays it; the B-string rule is a change of focus', () => {
    const t = lessonThread(FUNK_PLAN, SKILL_MAP);
    expect(t.scaleInApply).toBe(true);
    const dorian = GLOSSARY.find(g => g.id === 'dorian')!;
    expect(t.blocks.warmup!.intro).toContain(dorian.plain);
    expect(t.blocks.warmup!.intro).toContain('Funk players');
    expect(t.blocks.new_skill!.bridge).toBe('Change of focus: The B-string rule. Nothing carries over from the G dorian warm-up here.');
    expect(t.blocks.apply!.bridge).toContain('Same G dorian notes, now over the {Gm7} groove');
    expect(t.blocks.create!.bridge).toBe('Same {Gm7} as Apply. The notes come from the G dorian warm-up.');
    expect(t.path[0]).toBe('Warm-up: G dorian → Apply plays it over a Funk groove on {Gm7}.');
    expect(t.path).toContain('New skill: The B-string rule (separate from the scale).');
  });
  it('explains I–IV–V–I with the circle of fifths on a no-style day, and the path skips blocks the day lacks', () => {
    const t = lessonThread(PLAN, SKILL_MAP);
    expect(t.scaleInApply).toBe(false);
    const [i, iv, v] = PLAN.music.progression.chords;
    expect(t.blocks.apply!.intro).toContain(`{${iv}} and {${v}} sit either side of {${i}} on the circle of fifths`);
    expect(t.blocks.apply!.bridge).toMatch(/^Change of focus: /);
    expect(t.path.some(l => l.startsWith('Review'))).toBe(false); // PLAN has no review block
    expect(t.path.some(l => l.startsWith('Apply: strumming'))).toBe(true);
  });
  it('shortens profile names with a bracketed qualifier', () => {
    expect(shortStyleName('Country (classic/Nashville + modern)')).toBe('Country');
    expect(shortStyleName('R&B / neo-soul')).toBe('R&B / neo-soul');
  });
  it('gives every block but reset/record an intro and every later block a bridge, for every skill × style × key', () => {
    const retestSkill = SKILLS.find(s => s.id === 'rhythm.l1.locked_8ths')!;
    const theoryTopic = SKILLS.find(s => s.track === 'theory')!;
    const practice = SKILLS.filter(s => s.track !== 'theory');
    const choices = [{ profile: null, element: null }, ...STYLE_CATALOG.profiles.map(p => ({ profile: p, element: elementsOf(p)[0] }))];
    for (const { profile, element } of choices) for (const key of ['C', 'G', 'Bb', 'E']) {
      const music = buildMusic({ key, track: 'rhythm', style: profile, element });
      for (const skill of practice) {
        const plan: LessonPlan = {
          ...PLAN, key, skill_id: skill.id, music,
          style_element: element ? { style: profile!.id, element_id: element.id, kind: element.kind, is_new: false } : null,
          retest: { skill_id: retestSkill.id, target: targetFor(retestSkill) },
          review: [{ item_type: 'theory', ref: theoryTopic.id }],
          blocks: [
            { kind: 'retest', minutes: 2, items: [{ ref: `skill:${retestSkill.id}`, target: targetFor(retestSkill) }] },
            ...PLAN.blocks.slice(0, 3), // warmup, new_skill, reset
            { kind: 'review', minutes: 5, items: [{ ref: `theory:${theoryTopic.id}`, target: null }] },
            ...PLAN.blocks.slice(3), // apply, create, record
          ],
        };
        const t = lessonThread(plan, SKILL_MAP);
        const where = `${profile?.id ?? 'none'} ${key} ${skill.id}`;
        for (const b of plan.blocks) {
          const bt = t.blocks[b.kind];
          if (b.kind === 'reset') { expect(bt, where).toBeUndefined(); continue; }
          if (b.kind !== 'record') expect(bt?.intro, `${where} ${b.kind}`).toBeTruthy();
          if (b.kind !== 'warmup') expect(bt?.bridge, `${where} ${b.kind}`).toMatch(BRIDGE);
        }
        expect(t.path.length, where).toBeGreaterThan(0);
        expect(t.path.length, where).toBeLessThanOrEqual(5);
        expect(t.scaleInApply, where).toBe(!!profile && profile.scales[0] === music.scale.name);
      }
    }
  });
});
