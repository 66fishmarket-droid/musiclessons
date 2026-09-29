import { describe, expect, it } from 'vitest';
import { skillInfo } from '../../src/lib/skillInfo.ts';
import { SKILLS } from '../../supabase/seed/curriculum.ts';

describe('skillInfo', () => {
  it('joins the skill, its guide and its patterns', () => {
    const info = skillInfo('fingerstyle.l1.giuliani_arpeggios')!;
    expect(info.skill.name).toBe('Arpeggio patterns');
    expect(info.guide?.what).toMatch(/Giuliani/);
    expect(info.patterns.map(p => p.id)).toEqual(['giuliani_pim', 'giuliani_pmi', 'giuliani_pimi', 'giuliani_pima']);
  });
  it('has a guide for every fingerstyle skill', () => {
    for (const s of SKILLS.filter(x => x.track === 'fingerstyle')) expect(skillInfo(s.id)?.guide, s.id).not.toBeNull();
  });
  it('returns the bare skill when no guide is written yet, and null for unknown ids', () => {
    const r = skillInfo('theory.l1.intervals')!;
    expect(r.skill.id).toBe('theory.l1.intervals');
    expect(r.guide).toBeNull();
    expect(r.patterns).toEqual([]);
    expect(skillInfo('nope')).toBeNull();
  });
});
