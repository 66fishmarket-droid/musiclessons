import { describe, expect, it } from 'vitest';
import { BURSTS, burstSvg, rng } from '../../scripts/gen-bursts.ts';

describe('gen-bursts', () => {
  it('is deterministic per seed', () => {
    expect(rng(7)()).toBe(rng(7)());
    expect(rng(7)()).not.toBe(rng(8)());
    expect(burstSvg(BURSTS.today)).toBe(burstSvg(BURSTS.today));
  });
  it('writes standalone SVG with one gradient and five puffs per cloud, and some spray', () => {
    const svg = burstSvg(BURSTS.today);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.match(/<radialGradient /g)).toHaveLength(BURSTS.today.clouds.length);
    expect(svg.match(/<ellipse /g)).toHaveLength(BURSTS.today.clouds.length * 5);
    expect((svg.match(/<circle /g) ?? []).length).toBeGreaterThan(50);
    expect(svg).toContain('feTurbulence');
  });
  it('has a burst for today, done and every block colour except muted', () => {
    expect(Object.keys(BURSTS).sort()).toEqual(
      ['block-blue', 'block-gold', 'block-pink', 'block-saffron', 'block-teal', 'block-violet', 'done', 'today']);
  });
});
