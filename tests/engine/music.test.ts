import { describe, expect, it } from 'vitest';
import { Chord, Note } from 'tonal';
import {
  buildMusic, chordVoicings, degreeLabel, noteAt, scaleBox, scalePositions, triadInversions,
} from '../../supabase/functions/_shared/engine/music.ts';
import type { StyleProfile } from '../../supabase/functions/_shared/engine/styles.ts';

const sounded = (frets: number[]) => frets.flatMap((f, s) => (f < 0 ? [] : [Note.chroma(noteAt(s, f))]));

describe('noteAt', () => {
  it('names notes on the fretboard', () => {
    expect(noteAt(0, 0)).toBe('E');
    expect(noteAt(1, 3)).toBe('C');
    expect(Note.chroma(noteAt(5, 11))).toBe(Note.chroma('D#'));
  });
});

describe('scalePositions', () => {
  it('maps a scale with degrees', () => {
    const pos = scalePositions('C', 'major');
    expect(pos).toContainEqual({ string: 1, fret: 3, note: 'C', degree: 1 });
    expect(pos).toContainEqual({ string: 0, fret: 0, note: 'E', degree: 3 });
    expect(pos.some(p => p.note === 'C#')).toBe(false);
    expect(pos.every(p => p.fret >= 0 && p.fret <= 12)).toBe(true);
  });
  it('throws on unknown scales', () => expect(() => scalePositions('C', 'wibble')).toThrow(/Unknown scale/));
  it('labels a reduced scale by interval degree, not array index', () => {
    const pos = scalePositions('G', 'major pentatonic');
    for (const p of pos) expect([1, 2, 3, 5, 6]).toContain(p.degree);
  });
  it('gives both notes of a blues scale\'s b5/5 pair degree 5', () => {
    const pos = scalePositions('C', 'blues');
    const fifths = new Set(pos.filter(p => p.degree === 5).map(p => p.note));
    expect(fifths.size).toBe(2);
  });
});

describe('chordVoicings', () => {
  it.each(['Dm7', 'G7', 'Cmaj7', 'Bb', 'F#m7', 'Ebadd9', 'Db', 'E9', 'Am'])('%s voicings only sound chord tones', name => {
    const voicings = chordVoicings(name);
    expect(voicings.length).toBeGreaterThan(0);
    const tones = Chord.get(name).notes.map(n => Note.chroma(n));
    for (const v of voicings) {
      expect(v.frets).toHaveLength(6);
      expect(sounded(v.frets).every(c => tones.includes(c))).toBe(true);
    }
  });
  it('generates power chords', () => {
    expect(chordVoicings('A5')[0].frets).toEqual([5, 7, 7, -1, -1, -1]);
    expect(chordVoicings('E5')[0].frets).toEqual([0, 2, 2, -1, -1, -1]);
  });
  it('returns [] for chords missing from the database', () => expect(chordVoicings('C7#5#9')).toEqual([]));
});

describe('triadInversions', () => {
  it('finds all three inversions of C on the top strings, lowest first', () => {
    const shapes = triadInversions('C', [3, 4, 5]);
    expect(shapes).toContainEqual({ strings: [3, 4, 5], frets: [0, 1, 0], bass: 'G', inversion: 'second' });
    expect(shapes).toContainEqual({ strings: [3, 4, 5], frets: [5, 5, 3], bass: 'C', inversion: 'root' });
    expect(shapes).toContainEqual({ strings: [3, 4, 5], frets: [9, 8, 8], bass: 'E', inversion: 'first' });
    const lows = shapes.map(s => Math.min(...s.frets));
    expect(lows).toEqual([...lows].sort((a, b) => a - b));
  });
  it('skips chords with fewer than three notes', () => expect(triadInversions('C5', [3, 4, 5])).toEqual([]));
});

describe('buildMusic', () => {
  const style = {
    id: 'blues', name: 'Blues', family: 'blues',
    feel: { subdivision: 'shuffle', meter: '4/4', tempo_range: [60, 120], accents: '', swing_ratio: 2, clave: null },
    rhythm_patterns: [{ id: 'blues.shuffle', name: 'Shuffle', grid: 'B-D-B-D-B-D-B-D-'.split(''), accents: [], verified: true, note: null }],
    progressions: [{ id: 'blues.prog_quick', name: 'Quick change', roman: ['I7', 'IV7', 'I7', 'V7'], bars: 4, verified: true }],
    chord_colours: [], forms: [], fill_vocabulary: [], scales: ['minor pentatonic'], keys_common: [], tunings: [],
    lyric_traits: [], reference_tracks: [], transplant_levers: [], ladder: [],
  } satisfies StyleProfile;

  it('uses the style progression and scale in the key', () => {
    const m = buildMusic({ key: 'A', track: 'rhythm', style, element: { id: 'blues.shuffle', style: 'blues', kind: 'rhythm', name: 'Shuffle', verified: true } });
    expect(m.progression.chords).toEqual(['A7', 'D7', 'A7', 'E7']);
    expect(m.scale).toMatchObject({ tonic: 'A', name: 'minor pentatonic', notes: ['A', 'C', 'D', 'E', 'G'] });
    expect(Object.keys(m.voicings)).toEqual(['A7', 'D7', 'E7']);
    expect(m.rhythm?.name).toBe('Shuffle');
    expect(m.triads.length).toBeGreaterThan(0); // triads are always built from chords[0], not gated by track
  });
  it('builds triads for a non-fretboard (rhythm) track too, so a triad-skill retest on that day has a card', () => {
    const m = buildMusic({ key: 'G', track: 'rhythm', style: null, element: null });
    expect(m.triads.length).toBeGreaterThan(3);
  });
  it('defaults to I–IV–V–I in major without a style, with triads for fretboard lessons', () => {
    const m = buildMusic({ key: 'G', track: 'fretboard', style: null, element: null });
    expect(m.progression).toEqual({ roman: ['I', 'IV', 'V', 'I'], chords: ['G', 'C', 'D', 'G'] });
    expect(m.scale.name).toBe('major');
    expect(m.rhythm).toBeNull();
    expect(m.triads.length).toBeGreaterThan(3);
  });
});

describe('scaleBox', () => {
  it('takes a four-fret position from one fret below the lowest root on the E or A string', () => {
    const g = scaleBox(scalePositions('G', 'major'));
    expect([g.from, g.to]).toEqual([2, 5]);
    expect(g.notes.every(n => n.fret >= 2 && n.fret <= 5)).toBe(true);
    expect(g.notes).toContainEqual({ string: 0, fret: 3, note: 'G', degree: 1 });
    expect(g.notes).toHaveLength(17); // three notes on every string but B
    const c = scaleBox(scalePositions('C', 'major'));
    expect([c.from, c.to]).toEqual([2, 5]); // root on the A string, fret 3
  });
  it('uses open position when the root is an open string', () => {
    expect(scaleBox(scalePositions('E', 'minor'))).toMatchObject({ from: 0, to: 3 });
    expect(scaleBox(scalePositions('A', 'major'))).toMatchObject({ from: 0, to: 3 });
  });
});

describe('degreeLabel', () => {
  it('labels notes by their distance from the home note, with flats and sharps', () => {
    expect(['A', 'C', 'D', 'E', 'G'].map(n => degreeLabel('A', n))).toEqual(['1', 'b3', '4', '5', 'b7']);
    expect(['E', 'G', 'A', 'Bb', 'B', 'D'].map(n => degreeLabel('E', n))).toEqual(['1', 'b3', '4', 'b5', '5', 'b7']);
    expect(['G', 'A', 'B', 'C', 'D', 'E', 'F#'].map(n => degreeLabel('G', n))).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    expect(degreeLabel('C', 'F#')).toBe('#4');
  });
});
