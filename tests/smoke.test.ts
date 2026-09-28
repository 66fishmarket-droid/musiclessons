import { describe, expect, it } from 'vitest';
import { Progression } from 'tonal';

describe('toolchain', () => {
  it('resolves tonal and runs TypeScript tests', () => {
    expect(Progression.fromRomanNumerals('C', ['IIm7', 'V7'])).toEqual(['Dm7', 'G7']);
  });
});
