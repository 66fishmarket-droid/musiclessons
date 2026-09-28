import { describe, expect, it } from 'vitest';
import { KEY_CYCLE } from '../../supabase/functions/_shared/engine/keys.ts';
import { STYLES } from '../../supabase/functions/_shared/engine/styles.ts';
import { TRACKS } from '../../supabase/functions/_shared/engine/types.ts';
import { SKILLS } from '../../supabase/seed/curriculum.ts';
import { skillsToSql } from '../../scripts/gen-seed-sql.ts';

const byId = new Map(SKILLS.map(s => [s.id, s]));

describe('curriculum', () => {
  it('has unique ids of the form track.lN.slug matching track and level', () => {
    expect(byId.size).toBe(SKILLS.length);
    for (const s of SKILLS) expect(s.id).toMatch(new RegExp(`^${s.track}\\.l${s.level}\\.[a-z0-9_]+$`));
  });
  it('has at least two skills at every level of every track, including theory', () => {
    for (const t of [...TRACKS, 'theory']) for (const lvl of [1, 2, 3, 4, 5]) {
      expect(SKILLS.filter(s => s.track === t && s.level === lvl).length, `${t} L${lvl}`).toBeGreaterThanOrEqual(2);
    }
  });
  it('links theory topics, styles and keys that exist', () => {
    const styleIds = new Set(STYLES.map(s => s.id));
    for (const s of SKILLS) {
      if (s.theory_topic_id) expect(byId.get(s.theory_topic_id)?.track, s.id).toBe('theory');
      s.styles?.forEach(st => expect(styleIds.has(st), `${s.id} → ${st}`).toBe(true));
      s.allowed_keys?.forEach(k => expect(KEY_CYCLE as readonly string[]).toContain(k));
    }
  });
  it('gives measurable skills a default target', () => {
    for (const s of SKILLS) if (s.pass_metric !== 'self') expect(s.default_target, s.id).toBeGreaterThan(0);
  });
});

describe('skillsToSql', () => {
  it('inserts theory first so foreign keys resolve, and escapes quotes', () => {
    const sql = skillsToSql([
      { ...SKILLS.find(s => s.track === 'rhythm')!, name: "Rock 'n' roll" },
      SKILLS.find(s => s.track === 'theory')!,
    ]);
    expect(sql.indexOf("'theory.")).toBeLessThan(sql.indexOf("'rhythm."));
    expect(sql).toContain("'Rock ''n'' roll'");
    expect(sql).toContain('on conflict (id) do update');
  });
});
