import { describe, expect, it } from 'vitest';
import { clock, localDate, weekDays } from '../../src/lib/dates.ts';
import { keyAction } from '../../src/lib/keys.ts';
import { tempoLadder } from '../../src/lib/ladder.ts';
import { BLOCK_META, bpmTarget, refLabel, startBpm, tonicOf } from '../../src/lib/lesson.ts';
import { chordsIn, splitChords } from '../../src/lib/text.ts';
import { ugSearchUrl } from '../../src/lib/ug.ts';
import { PLAN } from './fixtures.ts';

describe('dates', () => {
  it('uses the device calendar day, not UTC', () => {
    expect(localDate(new Date(2026, 8, 29, 23, 30))).toBe('2026-09-29');
    expect(localDate(new Date(2026, 0, 5, 0, 5))).toBe('2026-01-05');
  });
  it('returns Monday..Sunday of the week', () => {
    const w = weekDays('2026-09-29'); // a Tuesday
    expect(w).toHaveLength(7);
    expect(w[0]).toBe('2026-09-28');
    expect(w[6]).toBe('2026-10-04');
    expect(weekDays('2026-10-04')[0]).toBe('2026-09-28'); // Sunday stays in the same week
  });
  it('formats a countdown, with overtime prefixed by +', () => {
    expect(clock(441)).toBe('7:21');
    expect(clock(5)).toBe('0:05');
    expect(clock(0)).toBe('0:00');
    expect(clock(-12)).toBe('+0:12');
  });
});

describe('splitChords', () => {
  it('splits braced chords out of text, in order', () => {
    expect(splitChords('Play {G} then {C/E}.')).toEqual([{ text: 'Play ' }, { chord: 'G' }, { text: ' then ' }, { chord: 'C/E' }, { text: '.' }]);
  });
  it('handles text with no chords and chords at the edges', () => {
    expect(splitChords('No chords here')).toEqual([{ text: 'No chords here' }]);
    expect(splitChords('{Am7}')).toEqual([{ chord: 'Am7' }]);
  });
  it('lists distinct chords across texts in first-seen order', () => {
    expect(chordsIn(['{G} {C} {G}', 'then {D}'])).toEqual(['G', 'C', 'D']);
  });
});

describe('ugSearchUrl', () => {
  it('builds an encoded title search', () => {
    expect(ugSearchUrl('Dust in the Wind', 'Kansas'))
      .toBe('https://www.ultimate-guitar.com/search.php?search_type=title&value=Dust%20in%20the%20Wind%20Kansas');
  });
});

describe('tempoLadder', () => {
  it('gives four rungs ending on the target', () => {
    expect(tempoLadder(39, 60)).toEqual([39, 46, 53, 60]);
  });
  it('collapses when there is no room to climb', () => {
    expect(tempoLadder(60, 60)).toEqual([60]);
    expect(tempoLadder(70, 60)).toEqual([60]);
    expect(tempoLadder(59, 60)).toEqual([59, 60]);
  });
});

describe('keyAction', () => {
  it('maps pedal and keyboard keys', () => {
    expect(keyAction(' ', 'BODY')).toBe('toggle');
    expect(keyAction('ArrowRight', 'BUTTON')).toBe('next');
    expect(keyAction('PageDown', undefined)).toBe('next');
    expect(keyAction('ArrowLeft', 'MAIN')).toBe('prev');
    expect(keyAction('PageUp', 'MAIN')).toBe('prev');
    expect(keyAction('a', 'BODY')).toBeNull();
  });
  it('does nothing while typing in a field', () => {
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT', 'input']) {
      expect(keyAction(' ', tag)).toBeNull();
      expect(keyAction('ArrowRight', tag)).toBeNull();
    }
  });
});

describe('lesson meta', () => {
  it('has a label and colour for every block kind', () => {
    for (const k of ['warmup', 'retest', 'new_skill', 'reset', 'review', 'apply', 'create', 'record'] as const) {
      expect(BLOCK_META[k].label).toBeTruthy();
    }
    expect(BLOCK_META.new_skill.colour).toBe('pink');
    expect(BLOCK_META.apply.colour).toBe('teal');
  });
  it('reads bpm targets and starting tempos', () => {
    expect(bpmTarget(PLAN, 1)).toBe(60);
    expect(bpmTarget(PLAN, 0)).toBeNull();
    expect(startBpm(PLAN, 1)).toBe(39);
    expect(startBpm(PLAN, 3)).toBe(39); // apply borrows the new skill's start tempo
  });
  it('gets a tonic from a key and a readable name from a ref', () => {
    expect(tonicOf('F#m')).toBe('F#');
    expect(tonicOf('Bb')).toBe('Bb');
    expect(tonicOf('G')).toBe('G');
    expect(refLabel('skill:fingerstyle.l1.giuliani_arpeggios')).toBe('giuliani arpeggios');
    expect(refLabel('theory:intervals_basic')).toBe('intervals basic');
  });
});
