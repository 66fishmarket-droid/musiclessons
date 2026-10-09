import { RECIPES } from '../../supabase/functions/_shared/engine/recipes.ts';
import { describe, expect, it } from 'vitest';
import { TUNINGS, noteAt } from '../../supabase/functions/_shared/engine/music.ts';
import { PATTERNS, swingOffset, nextBarChord, patternCounts, resolvePattern, rhythmCounts, rhythmPattern, voiceRoles } from '../../supabase/functions/_shared/engine/patterns.ts';
import { STYLE_CATALOG } from '../../supabase/functions/_shared/engine/styles.ts';

const G = { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3], barres: [] };
const C = { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], barres: [] };
const D = { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2], barres: [] };

describe('noteAt with tunings', () => {
  it('defaults to standard and counts semitones from any tuning', () => {
    expect(noteAt(0, 3)).toBe('G');
    expect(noteAt(0, 0, TUNINGS.dropD)).toBe('D');
    expect(noteAt(4, 0, TUNINGS.dadgad)).toBe('A');
    expect(noteAt(3, 4, TUNINGS.openD)).toBe('A#');
  });
});

describe('voiceRoles', () => {
  it('puts the thumb on the root and the fifth, fingers on the top three strings (G)', () => {
    expect(voiceRoles(G, 'G')).toEqual({ bass: 0, alt: 2, t1: 5, t2: 4, t3: 3 });
  });
  it('uses another chord tone for the alternate bass when the fifth sits in the treble (C: 4th string E)', () => {
    expect(voiceRoles(C, 'C')).toEqual({ bass: 1, alt: 2, t1: 5, t2: 4, t3: 3 });
  });
  it('shares the lowest treble string when there is no room below it (D: 4th and 3rd)', () => {
    expect(voiceRoles(D, 'D')).toEqual({ bass: 2, alt: 3, t1: 5, t2: 4, t3: 3 });
  });
  it('resolves the same roles in DADGAD from semitones alone (open Dsus4)', () => {
    expect(voiceRoles({ frets: [0, 0, 0, 0, 0, 0], fingers: [0, 0, 0, 0, 0, 0], barres: [] }, 'Dsus4', TUNINGS.dadgad))
      .toEqual({ bass: 0, alt: 1, t1: 5, t2: 4, t3: 3 });
  });
});

describe('resolvePattern', () => {
  it('turns roles into strings, pitches and intervals', () => {
    const steps = resolvePattern(PATTERNS.giuliani_pima, G, 'G');
    expect(steps[0]).toEqual([{ finger: 'p', role: 'bass', string: 0, note: 'G2', interval: 'R' }]);
    expect(steps[1]).toEqual([{ finger: 'i', role: 't3', string: 3, note: 'G3', interval: 'R' }]);
    expect(steps[2]).toEqual([{ finger: 'm', role: 't2', string: 4, note: 'B3', interval: '3' }]);
    expect(steps[3]).toEqual([{ finger: 'a', role: 't1', string: 5, note: 'G4', interval: 'R' }]);
  });
  it('plays the Travis alternate bass on the fifth', () => {
    expect(resolvePattern(PATTERNS.travis, G, 'G')[2]).toEqual([{ finger: 'p', role: 'alt', string: 2, note: 'D3', interval: '5' }]);
  });
});

describe('pattern library', () => {
  it('fills exactly one bar per pattern', () => {
    for (const p of Object.values(PATTERNS)) expect(p.steps.length, p.id).toBe(p.beatsPerBar * p.stepsPerBeat);
  });
});

describe('nextBarChord', () => {
  it('starts on the shown chord, then moves one chord per bar and wraps', () => {
    expect(nextBarChord(-1, 0, 4)).toBe(0);
    expect(nextBarChord(0, 0, 4)).toBe(1);
    expect(nextBarChord(3, 3, 4)).toBe(0);
  });
  it('plays a tapped chord next bar instead of skipping past it', () => {
    expect(nextBarChord(1, 3, 4)).toBe(3);
  });
  it('stays put on a single chord', () => {
    expect(nextBarChord(0, 0, 1)).toBe(0);
  });
});

describe('rhythmPattern', () => {
  it('turns boom-chick into a thumb bass on 1 and 3 and down-strums on 2 and 4, in 16ths', () => {
    const p = rhythmPattern('Boom-chick', 'B---D---B---D---'.split(''));
    expect(p).toMatchObject({ beatsPerBar: 4, stepsPerBeat: 4, bars: 1 });
    expect(p.steps[0]).toEqual([{ finger: 'p', role: 'bass' }]);
    expect(p.strokes![4]).toBe('D');
    expect(p.steps[4]).toEqual([]);
    expect(p.strokes![0]).toBeNull();
  });
  it('reads 12 slots as 3/4 when the name says so, else a 12/8 feel; 32 slots as two bars', () => {
    expect(rhythmPattern('Waltz boom-chuck-chuck (3/4, 12 slots)', 'B---D---D---'.split(''))).toMatchObject({ beatsPerBar: 3, stepsPerBeat: 4 });
    expect(rhythmPattern('Country-blues shuffle (12/8, 12 slots)', 'B-DB-DB-DB-D'.split(''))).toMatchObject({ beatsPerBar: 4, stepsPerBeat: 3 });
    expect(rhythmPattern('Guajeo 2-3', '--P---P-P---P---P---P-----P---P-'.split(''))).toMatchObject({ beatsPerBar: 4, stepsPerBeat: 4, bars: 2 });
  });
  it('plays fingers, pinches and single notes as picked notes', () => {
    const p = rhythmPattern('x', ['BP', 'P', 'N', '-'].concat(Array(12).fill('-')));
    expect(p.steps[0].map(s => s.role)).toEqual(['bass', 't3', 't2', 't1']);
    expect(p.steps[1].map(s => s.finger)).toEqual(['i', 'm', 'a']);
    expect(p.steps[2]).toEqual([{ finger: 'i', role: 't1' }]);
  });
  it('handles every rhythm in the style catalogue: one entry per slot, whole bars, known tokens', () => {
    for (const prof of STYLE_CATALOG.profiles) for (const r of prof.rhythm_patterns) {
      const p = rhythmPattern(r.name, r.grid);
      expect(p.steps).toHaveLength(r.grid.length);
      expect(p.beatsPerBar * p.stepsPerBeat * (p.bars ?? 1)).toBe(r.grid.length);
      r.grid.forEach((t, k) => {
        expect(['D', 'U', 'd', 'u', 'x', 'M', 'm', null], `${r.name} slot ${k} "${t}"`).toContain(p.strokes![k]);
        expect(p.steps[k].length > 0 || p.strokes![k] !== null || t === '-', `${r.name} slot ${k} "${t}"`).toBe(true);
      });
    }
  });
});

describe('boogie riff (5/6 tokens)', () => {
  const boogie = rhythmPattern('Shuffle boogie (root-5/root-6)', '5-65-65-65-6'.split(''));
  it('reads the 12-slot riff as a 12/8 feel with two-note steps', () => {
    expect(boogie).toMatchObject({ beatsPerBar: 4, stepsPerBeat: 3, bars: 1 });
    expect(boogie.steps[0].map(s => s.role)).toEqual(['riff_root', 'riff_5']);
    expect(boogie.steps[2].map(s => s.role)).toEqual(['riff_root', 'riff_6']);
    expect(boogie.strokes![0]).toBeNull();
  });
  it('puts each chord on whichever low string gives the lower fret, ignoring the chord shape', () => {
    const at = (chord: string, k: number) => resolvePattern(boogie, G, chord)[k].map(n => [n.string, n.fret, n.interval]);
    expect(at('Ab7', 0)).toEqual([[0, 4, 'R'], [1, 6, '5']]); // Ab on string 6 fret 4, Eb on string 5 fret 6
    expect(at('Ab7', 2)).toEqual([[0, 4, 'R'], [1, 8, '6']]);
    expect(at('Db7', 0)).toEqual([[1, 4, 'R'], [2, 6, '5']]); // IV moves across a string, same fret
    expect(at('Eb7', 2)).toEqual([[1, 6, 'R'], [2, 10, '6']]);
    expect(at('A7', 0)).toEqual([[1, 0, 'R'], [2, 2, '5']]); // open A string
  });
  it('explains the riff before the counts', () => {
    const words = rhythmCounts(boogie);
    expect(words).toMatch(/^Root-5\/root-6 means/);
    expect(words).toContain('1 root + 5th · 1-let root + 6th · 2 root + 5th');
  });
});

describe('style data says what is played (audit 2026-10-05)', () => {
  const all = STYLE_CATALOG.profiles.flatMap(prof => prof.rhythm_patterns);
  it('has no strums in patterns its research calls picked single notes or an arpeggio', () => {
    for (const r of all.filter(r => /single notes|arpeggio|alternate-picked across/i.test(`${r.name} ${r.note ?? ''}`) && /rock|neo_soul/.test(r.id))) {
      expect(r.grid.filter(t => 'DUdMm'.includes(t) && t !== '-'), r.id).toEqual([]);
    }
  });
  it('marks palm mutes in every strummed pattern called palm-muted or a chug', () => {
    for (const r of all.filter(r => /palm|chug/i.test(r.name) && !r.grid.some(t => t === '5' || t === '6'))) {
      expect(r.grid.some(t => t === 'M' || t === 'm'), r.id).toBe(true);
    }
  });
});

describe('picked single notes (audit group 2)', () => {
  const jangle = rhythmPattern('Jangle', 'lcnhncnhlcnhncnh'.split(''));
  it('picks one string at a time with the pick, root first, showing the shape fret', () => {
    expect(jangle.steps[0]).toEqual([{ finger: 'pick', role: 'bass' }]);
    expect(jangle.strokes![0]).toBeNull();
    expect(resolvePattern(jangle, G, 'G').slice(0, 4).map(s => [s[0].string, s[0].fret])).toEqual([[0, 3], [3, 0], [4, 0], [5, 3]]);
  });
  it('names the string on each count', () => {
    expect(rhythmCounts(rhythmPattern('x', 'l-------n---h---'.split(''))))
      .toBe('1 pick the root · 3 pick the second-highest string · 4 pick the highest string');
  });
});

describe('pushes into the next bar (audit group 5)', () => {
  it('marks slots from the push onwards as the next chord, and says so in the counts', () => {
    const p = rhythmPattern('Push', 'D-D-D-D-D-D-D-DU'.split(''), null, 14);
    expect(p.push).toBe(14);
    expect(rhythmCounts(p)).toMatch(/4& strum down \(next bar's chord, early\) · 4a strum up \(next bar's chord, early\)$/);
  });
  it('carries the push from the style data into the day and the anticipation skill', () => {
    const rock = STYLE_CATALOG.profiles.flatMap(x => x.rhythm_patterns).find(r => r.id === 'rock_classic.push_into_the_next_bar')!;
    expect(rock.push).toBe(14);
    expect(RECIPES['rhythm.l3.anticipations'].gridPush).toBe(14);
  });
});

describe('swing (audit group 3)', () => {
  it('delays each "&" by the swing ratio on 8th swing, leaving beats and 16th straight grids alone', () => {
    const p = rhythmPattern('Charleston', 'D-D-D-D-D-D-D-D-'.split(''), { ratio: 2, sixteenths: false });
    expect(swingOffset(p, 0)).toBe(0);
    expect(swingOffset(p, 2)).toBeCloseTo(2 / 3 - 0.5); // a beat fraction: the "&" moves to the last triplet
    expect(swingOffset(rhythmPattern('x', 'D-D-D-D-D-D-D-D-'.split('')), 2)).toBe(0);
  });
  it('delays the "e" and "a" on 16th swing', () => {
    const p = rhythmPattern('Ghost', 'DUDUDUDUDUDUDUDU'.split(''), { ratio: 1.4, sixteenths: true });
    expect(swingOffset(p, 2)).toBe(0);
    expect(swingOffset(p, 1)).toBeCloseTo((1.4 / 2.4 - 0.5) / 2);
  });
  it('ignores a ratio too small to hear and 12-slot grids already in triplets', () => {
    expect(rhythmPattern('x', 'D-D-D-D-D-D-D-D-'.split(''), { ratio: 1, sixteenths: false }).swing).toBeUndefined();
    expect(rhythmPattern('Shuffle', 'B-DB-DB-DB-D'.split(''), { ratio: 2, sixteenths: false }).swing).toBeUndefined();
  });
  it('says it is swung before the counts', () => {
    expect(rhythmCounts(rhythmPattern('x', 'D-D-------------'.split(''), { ratio: 2, sixteenths: false }))).toMatch(/^Swung: .*"&".* late\. 1 strum down · 1& strum down$/);
  });
});

describe('rhythmCounts', () => {
  it('spells out what the picking hand does on each count', () => {
    expect(rhythmCounts(rhythmPattern('Boom-chick', 'B---D---B---D---'.split(''))))
      .toBe('1 thumb plays the bass note · 2 strum down · 3 thumb plays the bass note · 4 strum down');
  });
  it('names off-beats and muted strokes', () => {
    expect(rhythmCounts(rhythmPattern('x', 'D-DUx-DU--------'.split(''))))
      .toBe('1 strum down · 1& strum down · 1a strum up · 2 mute (slap or choke) · 2& strum down · 2a strum up');
    expect(rhythmCounts(rhythmPattern('Shuffle (12/8, 12 slots)', 'B-DB-D------'.split(''))))
      .toBe('1 thumb plays the bass note · 1-let strum down · 2 thumb plays the bass note · 2-let strum down');
  });
  it('names palm-muted strokes', () => {
    expect(rhythmCounts(rhythmPattern('x', 'D-m-M-----------'.split('')))).toBe('1 strum down · 1& palm-muted strum up · 2 palm-muted strum down');
  });
  it('marks the second bar of a two-bar rhythm', () => {
    expect(rhythmCounts(rhythmPattern('Guajeo', 'P'.concat('-'.repeat(15), 'P', '-'.repeat(15)).split('')))).toBe('1 fingers pluck the top strings · bar 2: 1 fingers pluck the top strings');
  });
});

describe('patternCounts', () => {
  it('spells a pinch pattern count by count', () => {
    expect(patternCounts(PATTERNS.pinch))
      .toBe('1 thumb + ring together · 2 index · 3 thumb (alternate bass) + middle together · 4 index');
  });
  it('labels off-beats and triplets like rhythmCounts', () => {
    expect(patternCounts(PATTERNS.giuliani_pimi)).toBe('1 thumb · 1& index · 2 middle · 2& index · 3 thumb · 3& index · 4 middle · 4& index');
    expect(patternCounts(PATTERNS.giuliani_pim).startsWith('1 thumb · 1-trip index · 1-let middle · 2 thumb')).toBe(true);
  });
  it('skips rests (Travis beat 1&)', () => {
    expect(patternCounts(PATTERNS.travis).startsWith('1 thumb + middle together · 2 thumb (alternate bass) · 2& index')).toBe(true);
  });
  it('covers every pattern without throwing', () => {
    for (const p of Object.values(PATTERNS)) expect(patternCounts(p).length).toBeGreaterThan(0);
  });
});

describe('pull-off demo (q/o tokens; owner 2026-10-09: no way to hear the pull-off lesson)', () => {
  const pull = rhythmPattern('Pull-off', RECIPES['fills.l1.open_chord_pulloffs'].grid!.split(''));
  const A7 = { frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0], barres: [] };
  const D7 = { frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3], barres: [] };
  it('picks the highest fretted note on beat 4, then its open string on 4&', () => {
    const s = resolvePattern(pull, A7, 'A7');
    expect(s[12]).toMatchObject([{ role: 'pull', string: 4, fret: 2, note: 'C#4' }]);
    expect(s[14]).toMatchObject([{ role: 'pull_open', string: 4, fret: 0, note: 'B3' }]);
    expect(resolvePattern(pull, D7, 'D7')[14]).toMatchObject([{ string: 5, fret: 0 }]);
  });
  it('leaves the pull-off out on a full barre, where no fretted string can ring open', () => {
    const s = resolvePattern(pull, { frets: [5, 7, 5, 6, 5, 5], fingers: [1, 3, 1, 2, 1, 1], barres: [5] }, 'A7');
    expect(s[12]).toEqual([]);
    expect(s[14]).toEqual([]);
  });
});
