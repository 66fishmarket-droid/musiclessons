import { describe, expect, it } from 'vitest';
import { allowedChords, chordKey, validateColour } from '../../supabase/functions/_shared/lesson/contract.ts';
import { PLAN, SKILL_MAP, MET, validColour } from './fixtures.ts';

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

describe('validateColour', () => {
  it('accepts content that matches the plan', () => expect(validateColour(validColour(), PLAN, SKILL_MAP, MET)).toMatchObject({ ok: true }));
  it('rejects non-objects', () => expect(validateColour('x', PLAN, SKILL_MAP, MET)).toEqual({ ok: false, errors: ['not a JSON object'] }));
  it('needs exactly one block per plan block, in order', () => {
    const c = validColour();
    expect(validateColour({ ...c, blocks: c.blocks.slice(1) }, PLAN, SKILL_MAP, MET)).toMatchObject({ ok: false, errors: expect.arrayContaining(['blocks: expected 6, got 5']) });
    const swapped = [c.blocks[1], c.blocks[0], ...c.blocks.slice(2)];
    expect(validateColour({ ...c, blocks: swapped }, PLAN, SKILL_MAP, MET)).toMatchObject({
      ok: false, errors: expect.arrayContaining(['blocks[0].kind: expected warmup, got new_skill']) });
  });
  it('needs three songs with a capo from 0 to 12, unless relaxed', () => {
    const c = validColour();
    expect(validateColour({ ...c, songs: c.songs.slice(1) }, PLAN, SKILL_MAP, MET)).toMatchObject({ ok: false, errors: ['songs: expected 3, got 2'] });
    expect(validateColour({ ...c, songs: [{ ...c.songs[0], capo: 14 }, ...c.songs.slice(1)] }, PLAN, SKILL_MAP, MET))
      .toMatchObject({ ok: false, errors: ['songs[0].capo: expected 0-12'] });
    expect(validateColour({ ...c, songs: [] }, PLAN, SKILL_MAP, MET, { minSongs: 0 })).toMatchObject({ ok: true });
  });
  it('rejects chords that are not in the plan, braced or bare', () => {
    const c = validColour();
    const braced = { ...c, blocks: c.blocks.map((b, i) => (i === 0 ? { ...b, more: 'Swap in {Bm7} for colour.' } : b)) };
    expect(validateColour(braced, PLAN, SKILL_MAP, MET)).toEqual({ ok: false, errors: ['chord not in plan: Bm7'] });
    const bare = { ...c, blocks: c.blocks.map((b, i) => (i === 0 ? { ...b, more: 'Try a Bm7 instead.' } : b)) };
    expect(validateColour(bare, PLAN, SKILL_MAP, MET)).toEqual({ ok: false, errors: ['chord not in plan: Bm7'] });
  });
  it('never mistakes the article "A" or note names for chords', () => {
    const c = { ...validColour(), why_it_matters: 'A steady pulse matters: mute the E string and let the {G} ring. A B C are notes.' };
    expect(validateColour(c, PLAN, SKILL_MAP, MET)).toMatchObject({ ok: true });
  });
  it('accepts other spellings of plan chords and curriculum-named chords', () => {
    const plan = { ...PLAN, skill_id: 'fills.l1.sus_add_hammers' };
    const c = { ...validColour(plan), why_it_matters: 'Hammer {Dsus4} to {Gmaj}.' };
    expect(validateColour(c, plan, SKILL_MAP, MET)).toMatchObject({ ok: true });
  });
  it('never mistakes notes with octave numbers (a vocal range) for chords', () => {
    const c = { ...validColour(), why_it_matters: 'Sing between A2 and E4, then hold the {G}.' };
    expect(validateColour(c, PLAN, SKILL_MAP, MET)).toMatchObject({ ok: true });
  });
  it('never mistakes a high vocal range (octave 5) for power chords', () => {
    const c = { ...validColour(), why_it_matters: 'Stay within A3–E5 and sing up to G5 over the {G}.' };
    expect(validateColour(c, PLAN, SKILL_MAP, MET)).toMatchObject({ ok: true });
  });
  it('catches unbraced chords with a suffix after the number', () => {
    const c = { ...validColour(), why_it_matters: 'Try a C7sus4 or an E7#9 here.' };
    expect(validateColour(c, PLAN, SKILL_MAP, MET)).toEqual({ ok: false, errors: ['chord not in plan: C7sus4', 'chord not in plan: E7#9'] });
  });
  it('does not chord-check songs', () => {
    const c = validColour();
    const songs = [{ ...c.songs[0], why: 'Built on Am6 Dm6 E7.' }, ...c.songs.slice(1)];
    expect(validateColour({ ...c, songs }, PLAN, SKILL_MAP, MET)).toMatchObject({ ok: true });
  });
  it('refuses a model-supplied fallback flag', () => {
    expect(validateColour({ ...validColour(), fallback: true }, PLAN, SKILL_MAP, MET)).toEqual({ ok: false, errors: ['fallback: not allowed'] });
  });
});

describe('validateColour rules', () => {
  const withMore = (more: string) => ({ ...validColour(), blocks: validColour().blocks.map((b, i) => (i === 0 ? { ...b, more } : b)) });
  it('rejects a tempo or rep count', () => {
    expect(validateColour(withMore('Push to 90 bpm.'), PLAN, SKILL_MAP, MET)).toMatchObject({ ok: false });
    expect(validateColour(withMore('Do 5 clean reps.'), PLAN, SKILL_MAP, MET)).toMatchObject({ ok: false });
    expect(validateColour(withMore('Four bars per chord.'), PLAN, SKILL_MAP, MET)).toMatchObject({ ok: true });
  });
  it('rejects a more over 400 characters', () => {
    expect(validateColour(withMore('x'.repeat(401)), PLAN, SKILL_MAP, MET)).toMatchObject({ ok: false });
  });
  it('rejects naming a curriculum skill the learner has not met', () => {
    expect(validateColour(withMore('Next you will learn Travis picking.'), PLAN, SKILL_MAP, MET)).toMatchObject({ ok: false });
    expect(validateColour(withMore('Like your Travis picking.'), PLAN, SKILL_MAP, { ...MET, metSkills: ['fingerstyle.l3.travis_basic'] })).toMatchObject({ ok: true });
  });
  it('allows a skill name that the engine steps already use (Review Focus 1)', () => {
    expect(validateColour(withMore('Ghost strums keep the hand moving.'), PLAN, SKILL_MAP, { ...MET, stepsText: '2 muted strum down · ghost strums' })).toMatchObject({ ok: true });
  });
  it("allows today's skill name", () => {
    const today = SKILL_MAP.get(PLAN.skill_id)!.name;
    expect(validateColour(withMore(`${today} is today.`), PLAN, SKILL_MAP, MET)).toMatchObject({ ok: true });
  });
});
