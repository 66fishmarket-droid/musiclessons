import { describe, expect, it } from 'vitest';
import { allowedChords, chordKey, validateLesson } from '../../supabase/functions/_shared/lesson/contract.ts';
import { PLAN, SKILL_MAP, validContent } from './fixtures.ts';

describe('fixture plan', () => {
  it('is a rhythm lesson in G over G C D G with six blocks', () => {
    expect(PLAN).toMatchObject({ track: 'rhythm', key: 'G', retest: null, review: [] });
    expect(PLAN.music.progression.chords).toEqual(['G', 'C', 'D', 'G']);
    expect(PLAN.blocks.map(b => b.kind)).toEqual(['warmup', 'new_skill', 'reset', 'apply', 'create', 'record']);
  });
});

describe('chordKey', () => {
  it('ignores spelling but not structure', () => {
    expect(chordKey('A#m7')).toBe(chordKey('Bbm7'));
    expect(chordKey('Amin7')).toBe(chordKey('Am7'));
    expect(chordKey('Am7')).not.toBe(chordKey('A7'));
    expect(chordKey('Hm7')).toBeNull();
  });
});

describe('allowedChords', () => {
  it('is the plan progression plus voicings', () => expect(allowedChords(PLAN, SKILL_MAP)).toEqual(['G', 'C', 'D']));
  it('adds every chord of a progression named in the day\'s curriculum text, plain letters included', () => {
    const sus = { ...PLAN, key: 'Bb', music: { ...PLAN.music, progression: { roman: ['I'], chords: ['Bb'] }, voicings: {} }, skill_id: 'fills.l1.sus_add_hammers' };
    expect(allowedChords(sus, SKILL_MAP)).toEqual(['Bb', 'Dsus4', 'D', 'Dsus2']); // "Dsus4–D–Dsus2"
    const walk = { ...sus, skill_id: 'fills.l2.bass_walks' };
    expect(allowedChords(walk, SKILL_MAP)).toEqual(expect.arrayContaining(['G', 'G/F#', 'Em'])); // "G–G/F#–Em"
  });
  it('does not treat hyphenated words as progressions', () => {
    const plan = { ...PLAN, skill_id: 'songwriting.l1.core_loops' }; // "I–IV–V–vi loops": numerals, not chords
    expect(allowedChords(plan, SKILL_MAP)).toEqual(['G', 'C', 'D']);
  });
});

describe('validateLesson', () => {
  it('accepts content that matches the plan', () => expect(validateLesson(validContent(), PLAN, SKILL_MAP)).toMatchObject({ ok: true }));
  it('rejects non-objects', () => expect(validateLesson('x', PLAN, SKILL_MAP)).toEqual({ ok: false, errors: ['not a JSON object'] }));
  it('needs exactly one block per plan block, in order', () => {
    const c = validContent();
    expect(validateLesson({ ...c, blocks: c.blocks.slice(1) }, PLAN, SKILL_MAP)).toMatchObject({ ok: false, errors: expect.arrayContaining(['blocks: expected 6, got 5']) });
    const swapped = [c.blocks[1], c.blocks[0], ...c.blocks.slice(2)];
    expect(validateLesson({ ...c, blocks: swapped }, PLAN, SKILL_MAP)).toMatchObject({
      ok: false, errors: expect.arrayContaining(['blocks[0].kind: expected warmup, got new_skill']) });
  });
  it('needs three songs with a capo from 0 to 12, unless relaxed', () => {
    const c = validContent();
    expect(validateLesson({ ...c, songs: c.songs.slice(1) }, PLAN, SKILL_MAP)).toMatchObject({ ok: false, errors: ['songs: expected 3, got 2'] });
    expect(validateLesson({ ...c, songs: [{ ...c.songs[0], capo: 14 }, ...c.songs.slice(1)] }, PLAN, SKILL_MAP))
      .toMatchObject({ ok: false, errors: ['songs[0].capo: expected 0-12'] });
    expect(validateLesson({ ...c, songs: [] }, PLAN, SKILL_MAP, { minSongs: 0 })).toMatchObject({ ok: true });
  });
  it('rejects chords that are not in the plan, braced or bare', () => {
    const c = validContent();
    const braced = { ...c, create_prompt: 'Swap in {Bm7} for colour.' };
    expect(validateLesson(braced, PLAN, SKILL_MAP)).toEqual({ ok: false, errors: ['chord not in plan: Bm7'] });
    const bare = { ...c, blocks: c.blocks.map((b, i) => (i === 1 ? { ...b, tips: 'Try a Bm7 instead.' } : b)) };
    expect(validateLesson(bare, PLAN, SKILL_MAP)).toEqual({ ok: false, errors: ['chord not in plan: Bm7'] });
  });
  it('never mistakes the article "A" or note names for chords', () => {
    const c = { ...validContent(), why_it_matters: 'A steady pulse matters: mute the E string and let the {G} ring. A B C are notes.' };
    expect(validateLesson(c, PLAN, SKILL_MAP)).toMatchObject({ ok: true });
  });
  it('accepts other spellings of plan chords and curriculum-named chords', () => {
    const plan = { ...PLAN, skill_id: 'fills.l1.sus_add_hammers' };
    const c = { ...validContent(plan), why_it_matters: 'Hammer {Dsus4} to {Gmaj}.' };
    expect(validateLesson(c, plan, SKILL_MAP)).toMatchObject({ ok: true });
  });
  it('does not chord-check songs', () => {
    const c = validContent();
    const songs = [{ ...c.songs[0], why: 'Built on Am6 Dm6 E7.' }, ...c.songs.slice(1)];
    expect(validateLesson({ ...c, songs }, PLAN, SKILL_MAP)).toMatchObject({ ok: true });
  });
  it('refuses a model-supplied fallback flag', () => {
    expect(validateLesson({ ...validContent(), fallback: true }, PLAN, SKILL_MAP)).toEqual({ ok: false, errors: ['fallback: not allowed'] });
  });
});
