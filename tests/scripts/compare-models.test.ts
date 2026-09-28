import { describe, expect, it } from 'vitest';
import { planLesson } from '../../supabase/functions/_shared/engine/planner.ts';
import { STYLE_CATALOG } from '../../supabase/functions/_shared/engine/styles.ts';
import { FIXTURES, renderComparison } from '../../scripts/compare-models.ts';

describe('FIXTURES', () => {
  it('cover a first lesson, a retest-and-review day and a repeat day on three tracks', () => {
    const plans = FIXTURES.map(f => planLesson(f.state, STYLE_CATALOG));
    expect(new Set(plans.map(p => p.track)).size).toBe(3);
    expect(plans[1].retest?.skill_id).toBe('fills.l1.sus_add_hammers');
    expect(plans[1].review.length).toBeGreaterThan(0);
    expect(plans[2]).toMatchObject({ is_repeat: true, track: 'fingerstyle', key: 'D', template: 'standard_25' });
  });
});

describe('renderComparison', () => {
  it('escapes model output, lists validation errors and meets the page contract', () => {
    const plan = planLesson(FIXTURES[0].state, STYLE_CATALOG);
    const html = renderComparison([{
      fixture: FIXTURES[0].name, plan, model: 'm1', ok: false, errors: ['chord not in plan: Bm7'],
      content: { title: '<script>alert(1)</script>', blocks: 'not an array' } as never, cost: 0.0123, ms: 1500,
    }], ['m1', 'm2'], '2026-09-28');
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('chord not in plan: Bm7');
    expect(html).toContain('<title>Model Comparison</title>');
    expect(html).toContain('prefers-color-scheme: dark');
    expect(html).toContain('not run');
  });
});
