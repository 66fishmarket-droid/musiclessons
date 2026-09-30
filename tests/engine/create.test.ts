import { describe, expect, it } from 'vitest';
import { CREATE_TASKS, pickCreateTask } from '../../supabase/functions/_shared/engine/create.ts';
import { renderSteps, slotContext } from '../../supabase/functions/_shared/engine/render.ts';
import { PLAN } from '../lesson/fixtures.ts';

describe('Create library', () => {
  it('renders every task for the fixture plan', () => {
    const ctx = slotContext(PLAN, {});
    for (const t of CREATE_TASKS) expect(() => renderSteps([t.prompt, ...t.steps], ctx), t.id).not.toThrow();
  });
  it('says what the hands and the voice do in every task', () => {
    for (const t of CREATE_TASKS) expect(t.steps.join(' '), t.id).toMatch(/sing|say/i);
  });
  it('never repeats any of the last three tasks', () => {
    const recent = ['melody_135', 'question_answer', 'rhyming_couplet'];
    for (const d of ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']) {
      expect(recent).not.toContain(pickCreateTask(d, 'rhythm.l1.locked_8ths', recent));
    }
  });
  it('picks a task that uses the day\'s songwriting skill', () => {
    expect(pickCreateTask('2026-10-01', 'songwriting.l2.melody_skeleton', [])).toBe('question_answer');
  });
  it('rotates by date', () => {
    const picks = new Set(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'].map(d => pickCreateTask(d, 'x', [])));
    expect(picks.size).toBeGreaterThan(1);
  });
});
