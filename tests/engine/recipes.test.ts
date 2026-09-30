import { describe, expect, it } from 'vitest';
import { buildMusic } from '../../supabase/functions/_shared/engine/music.ts';
import { PATTERNS, rhythmPattern } from '../../supabase/functions/_shared/engine/patterns.ts';
import { RECIPES, recipeFor } from '../../supabase/functions/_shared/engine/recipes.ts';
import { CREATE_TASKS } from '../../supabase/functions/_shared/engine/create.ts';
import { renderSteps, slotContext } from '../../supabase/functions/_shared/engine/render.ts';
import { targetFor } from '../../supabase/functions/_shared/engine/planner.ts';
import { STYLE_CATALOG, elementsOf } from '../../supabase/functions/_shared/engine/styles.ts';
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
  it('has a recipe for every fills skill with the right card', () => {
    for (const s of SKILLS.filter(x => x.track === 'fills')) {
      expect(RECIPES[s.id], s.id).toBeDefined();
      expect(['chords'], s.id).toContain(RECIPES[s.id].card);
    }
  });
  it('has a recipe for every songwriting skill with the right card', () => {
    for (const s of SKILLS.filter(x => x.track === 'songwriting')) {
      expect(RECIPES[s.id], s.id).toBeDefined();
      expect(['chords', 'none'], s.id).toContain(RECIPES[s.id].card);
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
  it('highlights on the scale card every degree its own steps name via a {degrees:N} token', () => {
    const TOKEN = /\{degrees:([\d,]+)\}/g;
    for (const [id, r] of Object.entries(RECIPES)) {
      if (r.card !== 'scale') continue;
      const named = new Set<number>();
      for (const step of r.steps) for (const [, nums] of step.matchAll(TOKEN)) nums.split(',').forEach(n => named.add(Number(n)));
      const highlighted = new Set(r.degrees ?? []);
      for (const n of named) expect(highlighted.has(n), `${id}: {degrees:${n}} named in steps but not highlighted on the card`).toBe(true);
    }
  });
  it('renders every recipe and every Create task without an unfilled slot, for every style\'s scale', () => {
    const seenScales = new Set<string>();
    for (const profile of STYLE_CATALOG.profiles) {
      const scaleName = profile.scales[0];
      if (!scaleName || seenScales.has(scaleName)) continue;
      seenScales.add(scaleName);
      const element = elementsOf(profile).find(e => e.kind === 'progression') ?? null;
      const music = buildMusic({ key: 'G', track: 'fretboard', style: profile, element });
      const plan = { ...PLAN, key: 'G', music };
      for (const [id, r] of Object.entries(RECIPES)) {
        const skill = SKILLS.find(s => s.id === id)!;
        const ctx = slotContext(plan, { target: targetFor(skill), patternId: r.patterns?.[0] ?? null, grid: r.grid ?? null, gridName: r.gridName ?? null });
        expect(() => renderSteps(r.steps, ctx), `${id} in ${scaleName}`).not.toThrow();
      }
      for (const t of CREATE_TASKS) {
        const ctx = slotContext(plan, {});
        expect(() => renderSteps([t.prompt, ...t.steps], ctx), `${t.id} in ${scaleName}`).not.toThrow();
      }
    }
  });
  it('has a recipe for every practice skill', () => {
    expect(SKILLS.filter(s => s.track !== 'theory' && !RECIPES[s.id]).map(s => s.id)).toEqual([]);
  });
});
