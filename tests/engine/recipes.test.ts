import { describe, expect, it } from 'vitest';
import { buildMusic } from '../../supabase/functions/_shared/engine/music.ts';
import { PATTERNS, rhythmPattern } from '../../supabase/functions/_shared/engine/patterns.ts';
import { RECIPES, recipeFor } from '../../supabase/functions/_shared/engine/recipes.ts';
import { renderSteps, slotContext } from '../../supabase/functions/_shared/engine/render.ts';
import { targetFor } from '../../supabase/functions/_shared/engine/planner.ts';
import { SKILLS } from '../../supabase/seed/curriculum.ts';
import { PLAN } from '../lesson/fixtures.ts';

const KEYS = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb'];
const practice = SKILLS.filter(s => s.track !== 'theory');

describe('recipes', () => {
  it('has a recipe for every fingerstyle skill, with known patterns', () => {
    for (const s of practice.filter(x => x.track === 'fingerstyle')) {
      const r = RECIPES[s.id];
      expect(r, s.id).toBeDefined();
      expect(r.card).toBe('pattern');
      for (const p of r.patterns ?? []) expect(PATTERNS[p], `${s.id} → ${p}`).toBeDefined();
    }
  });
  it('renders every written recipe in every key without an unfilled slot', () => {
    for (const [id, r] of Object.entries(RECIPES)) {
      const skill = SKILLS.find(s => s.id === id)!;
      for (const key of KEYS) {
        const plan = { ...PLAN, key, music: buildMusic({ key, track: skill.track === 'theory' ? 'rhythm' : skill.track, style: null, element: null }) };
        const ctx = slotContext(plan, { target: targetFor(skill), patternId: r.patterns?.[0] ?? null, grid: r.grid ?? null, gridName: r.gridName ?? null });
        expect(() => renderSteps(r.steps, ctx), `${id} in ${key}`).not.toThrow();
      }
      if (r.grid) expect(() => rhythmPattern(r.gridName ?? id, r.grid!.split(''))).not.toThrow();
      expect(r.listenFor.length, id).toBeGreaterThan(0);
    }
  });
  it('has a recipe for every rhythm skill with the right card', () => {
    for (const s of SKILLS.filter(x => x.track === 'rhythm')) {
      expect(RECIPES[s.id], s.id).toBeDefined();
      expect(['rhythm'], s.id).toContain(RECIPES[s.id].card);
    }
  });
  it('has a recipe for every ear_voice skill with the right card', () => {
    for (const s of SKILLS.filter(x => x.track === 'ear_voice')) {
      expect(RECIPES[s.id], s.id).toBeDefined();
      expect(['scale'], s.id).toContain(RECIPES[s.id].card);
    }
  });
  it('has a recipe for every fretboard skill with the right card', () => {
    for (const s of SKILLS.filter(x => x.track === 'fretboard')) {
      expect(RECIPES[s.id], s.id).toBeDefined();
      expect(['note_caller', 'triads', 'scale'], s.id).toContain(RECIPES[s.id].card);
    }
  });
  it('has non-empty degrees within 1-7 for every ear_voice recipe', () => {
    for (const s of SKILLS.filter(x => x.track === 'ear_voice')) {
      const degrees = RECIPES[s.id]?.degrees ?? [];
      expect(degrees.length, s.id).toBeGreaterThan(0);
      for (const d of degrees) {
        expect(d, s.id).toBeGreaterThanOrEqual(1);
        expect(d, s.id).toBeLessThanOrEqual(7);
      }
    }
  });
  it('falls back to a generic recipe built from the description', () => {
    const s = SKILLS.find(x => !RECIPES[x.id] && x.track !== 'theory');
    if (!s) return; // every recipe written (Task 14 turns this into a hard requirement)
    const r = recipeFor(s);
    expect(r.card).toBe('none');
    expect(r.steps[0]).toBe(s.description);
  });
});
