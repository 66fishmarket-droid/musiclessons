import { describe, expect, it } from 'vitest';
import { buildMusic } from '../../supabase/functions/_shared/engine/music.ts';
import { PATTERNS, rhythmPattern } from '../../supabase/functions/_shared/engine/patterns.ts';
import { RECIPES, recipeFor } from '../../supabase/functions/_shared/engine/recipes.ts';
import { MAP_KINDS } from '../../supabase/functions/_shared/engine/neck.ts';
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
      expect(['note_caller', 'triads', 'scale', 'neck_map'], s.id).toContain(RECIPES[s.id].card);
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

describe('fretboard shortcuts recipes', () => {
  const SHORTCUTS = ['fretboard.l1.notes_e_a', 'fretboard.l1.b_string_rule', 'fretboard.l1.octave_shapes',
    'fretboard.l2.interval_shapes', 'fretboard.l2.caged_linked', 'fretboard.l2.pentatonic_per_shape',
    'fretboard.l2.progression_grid', 'fretboard.l4.one_string_scale'];
  const ELEMENTS = ['card', 'chords', 'metronome', 'note_caller', 'scale', 'recorder'];
  it('gives every recipe and every create task a per-step show list matching its steps', () => {
    for (const [id, r] of Object.entries(RECIPES)) expect(r.show?.length, id).toBe(r.steps.length);
    for (const t of CREATE_TASKS) {
      expect(t.show.length, t.id).toBe(t.steps.length);
      expect(t.show.at(-1), t.id).toContain('recorder');
      t.show.slice(0, -1).forEach(els => expect(els, t.id).not.toContain('recorder'));
    }
  });
  it('gives every shortcut skill a per-step show list matching its steps', () => {
    for (const id of SHORTCUTS) {
      const r = RECIPES[id];
      expect(r, id).toBeDefined();
      expect(r.show?.length, id).toBe(r.steps.length);
    }
  });
  it('uses only known step elements, and never note_caller on a note_caller card', () => {
    for (const [id, r] of Object.entries(RECIPES)) for (const els of r.show ?? []) {
      for (const e of els) expect(ELEMENTS, id).toContain(e);
      if (r.card === 'note_caller') expect(els, id).not.toContain('note_caller');
    }
  });
  it('shows the metronome on every step that carries the bpm ladder', () => {
    for (const [id, r] of Object.entries(RECIPES)) r.show?.forEach((els, k) => {
      if (r.steps[k].includes('{start_bpm}')) expect(els, `${id} step ${k + 1}`).toContain('metronome');
    });
  });
  it('gives every neck_map recipe a valid map kind', () => {
    for (const [id, r] of Object.entries(RECIPES)) if (r.card === 'neck_map') expect(MAP_KINDS, id).toContain(r.map);
  });
  it('wires the new skills to the agreed cards and maps', () => {
    expect(RECIPES['fretboard.l1.b_string_rule']).toMatchObject({ card: 'neck_map', map: 'unisons' });
    expect(RECIPES['fretboard.l1.octave_shapes']).toMatchObject({ card: 'neck_map', map: 'octaves' });
    expect(RECIPES['fretboard.l2.interval_shapes']).toMatchObject({ card: 'neck_map', map: 'intervals' });
    expect(RECIPES['fretboard.l2.progression_grid']).toMatchObject({ card: 'neck_map', map: 'grid', majorKeyOnly: true });
    expect(RECIPES['fretboard.l4.one_string_scale']).toMatchObject({ card: 'neck_map', map: 'one_string' });
  });
});
