import { describe, expect, it } from 'vitest';
import { curriculumNotes } from '../../scripts/vault-sync-curriculum.ts';
import { devNotes } from '../../scripts/vault-sync-dev.ts';
import { styleNotes } from '../../scripts/vault-sync-styles.ts';

describe('styleNotes', () => {
  const notes = styleNotes('2026-09-28');
  it('writes one note per style plus a families hub', () => {
    expect(notes.find(n => n.path === 'Styles/funk.md')!.frontmatter).toMatchObject({ generated: true, style_id: 'funk', family: 'funk' });
    expect(notes.find(n => n.path === 'Styles/_Families.md')!.body).toContain('[[funk]]');
  });
  it('shows progressions in C and marks unverified patterns', () => {
    const blues = notes.find(n => n.path === 'Styles/blues.md')!.body;
    expect(blues).toMatch(/C7 .*F7/);
    expect(notes.find(n => n.path === 'Styles/folk.md')!.body).toContain('unverified');
  });
});

describe('curriculumNotes', () => {
  const notes = curriculumNotes(new Map([['rhythm.l1.locked_8ths', {
    skill_id: 'rhythm.l1.locked_8ths', status: 'mastered', score: 0, current_target: 90, last_seen: '2026-09-01', last_key: 'G' }]]), '2026-09-28');
  it('writes a note per skill with progress merged in and theory links', () => {
    const n = notes.find(n => n.path === 'Curriculum/Rhythm & Groove/rhythm.l1.locked_8ths.md')!;
    expect(n.frontmatter).toMatchObject({ generated: true, status: 'mastered', current_target: 90, level: 1 });
    const tri = notes.find(n => n.path === 'Curriculum/Fretboard & Voicings/fretboard.l3.triads_321.md')!;
    expect(tri.frontmatter.theory_topic).toBe('[[theory.l2.triads]]');
    expect(tri.frontmatter.status).toBe('not started');
  });
  it('writes a hub per track grouped by level', () => {
    const hub = notes.find(n => n.path === 'Curriculum/Rhythm & Groove.md')!;
    expect(hub.body).toContain('## Level 1');
    expect(hub.body).toContain('[[rhythm.l1.locked_8ths]] — Locked 8ths and 16ths ✅');
  });
});

describe('devNotes', () => {
  const notes = devNotes('2026-09-29|abc1234|feat: planner\n2026-09-28|def5678|chore: toolchain',
    [{ name: 'SESSION_HANDOFF_2026-09-28.md', text: '# Handoff\nDid things.' }], '2026-09-29',
    [{ path: 'superpowers/specs/design.md', text: '# Design\nWhy.' }]);
  it('writes a dated timeline linking handoffs', () => {
    const t = notes.find(n => n.path === 'Development/Timeline.md')!.body;
    expect(t.indexOf('## 2026-09-29')).toBeLessThan(t.indexOf('## 2026-09-28'));
    expect(t).toContain('- `abc1234` feat: planner');
    expect(t).toContain('[[SESSION_HANDOFF_2026-09-28]]');
  });
  it('copies handoffs into the vault as generated notes', () => {
    expect(notes.find(n => n.path === 'Development/Handoffs/SESSION_HANDOFF_2026-09-28.md')!.body).toContain('Did things.');
  });
  it('copies other docs keeping their folders', () => {
    expect(notes.find(n => n.path === 'Development/Docs/superpowers/specs/design.md')!.body).toContain('Why.');
  });
});
