import { describe, expect, it } from 'vitest';
import { KEY_CYCLE } from '../../supabase/functions/_shared/engine/keys.ts';
import { buildMusic } from '../../supabase/functions/_shared/engine/music.ts';
import { renderSteps, slotContext } from '../../supabase/functions/_shared/engine/render.ts';
import { THEORY_REVIEWS } from '../../supabase/functions/_shared/engine/theory.ts';
import { SKILLS } from '../../supabase/seed/curriculum.ts';
import { PLAN } from '../lesson/fixtures.ts';

describe('THEORY_REVIEWS', () => {
  it('gives every theory topic a concrete review task', () => {
    for (const s of SKILLS.filter(x => x.track === 'theory')) {
      expect(THEORY_REVIEWS[s.id], s.id).toBeDefined();
      expect(THEORY_REVIEWS[s.id].length, s.id).toBeGreaterThan(60);
    }
  });
  it('renders in every key against the major scale without an unfilled slot', () => {
    for (const key of KEY_CYCLE) {
      const plan = { ...PLAN, key, music: buildMusic({ key, track: 'rhythm', style: null, element: null }) };
      const ctx = { ...slotContext(plan, {}), scale: 'major' };
      for (const [id, t] of Object.entries(THEORY_REVIEWS)) expect(() => renderSteps([t], ctx), `${id} in ${key}`).not.toThrow();
    }
  });
});
