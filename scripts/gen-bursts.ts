import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, isMain } from './vault/lib.ts';

export interface Cloud { cx: number; cy: number; rx: number; ry: number; colour: string; core: string }
export interface BurstSpec { w: number; h: number; seed: number; dots: number; clouds: Cloud[] }

/** Deterministic PRNG (mulberry32) so regenerated bursts are byte-identical. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Standalone powder-cloud SVG: gradient puffs through blur + turbulence + noise-mask, plus a seeded particle spray. */
export function burstSvg({ w, h, seed, dots, clouds }: BurstSpec): string {
  const r = rng(seed);
  const between = (a: number, b: number) => a + (b - a) * r();
  const gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const grads: string[] = [];
  const puffs: string[] = [];
  const spray: string[] = [];
  clouds.forEach((c, i) => {
    grads.push(`<radialGradient id="g${i}"><stop offset="0" stop-color="${c.core}"/><stop offset="0.45" stop-color="${c.colour}" stop-opacity="0.85"/><stop offset="1" stop-color="${c.colour}" stop-opacity="0"/></radialGradient>`);
    puffs.push(`<ellipse cx="${c.cx}" cy="${c.cy}" rx="${c.rx}" ry="${c.ry}" fill="url(#g${i})"/>`);
    for (let k = 0; k < 4; k++) { // satellite puffs make the edge billow instead of forming one blob
      const a = between(0, 2 * Math.PI);
      const d = between(0.5, 0.95);
      puffs.push(`<ellipse cx="${r1(c.cx + Math.cos(a) * c.rx * d)}" cy="${r1(c.cy + Math.sin(a) * c.ry * d)}" rx="${r1(c.rx * between(0.3, 0.5))}" ry="${r1(c.ry * between(0.3, 0.5))}" fill="url(#g${i})" opacity="0.8"/>`);
    }
  });
  for (let k = 0; k < dots; k++) {
    const c = clouds[Math.floor(r() * clouds.length)];
    const a = between(0, 2 * Math.PI);
    const d = Math.abs(1 + 0.45 * gauss()) * 1.2; // spray sits around and beyond the cloud edge
    const x = c.cx + Math.cos(a) * c.rx * d;
    const y = c.cy + Math.sin(a) * c.ry * d;
    const size = [0.6, 0.8, 1, 1, 1.3, 1.7, 2.2][Math.floor(r() * 7)];
    const fill = r() < 0.5 ? c.colour : c.core;
    const opacity = r1(between(0.35, 0.95));
    if (x < 0 || x > w || y < 0 || y > h) continue;
    spray.push(`<circle cx="${r1(x)}" cy="${r1(y)}" r="${size}" fill="${fill}" opacity="${opacity}"/>`);
  }
  const filter = `<filter id="p" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">`
    + `<feGaussianBlur in="SourceGraphic" stdDeviation="10" result="soft"/>`
    + `<feTurbulence type="fractalNoise" baseFrequency="0.014 0.024" numOctaves="4" seed="${seed}" result="warp"/>`
    + `<feDisplacementMap in="soft" in2="warp" scale="95" xChannelSelector="R" yChannelSelector="G" result="wisp"/>`
    + `<feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed="${seed + 5}" result="cloud"/>`
    + `<feColorMatrix in="cloud" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.6 0 0 0 -0.75" result="billow"/>`
    + `<feComposite in="wisp" in2="billow" operator="in" result="puffs"/>`
    + `<feComponentTransfer in="wisp" result="haze"><feFuncA type="linear" slope="0.4"/></feComponentTransfer>`
    + `<feMerge><feMergeNode in="haze"/><feMergeNode in="puffs"/></feMerge></filter>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${grads.join('')}${filter}</defs><g filter="url(#p)">${puffs.join('')}</g>${spray.join('')}</svg>\n`;
}

// Burst palette (UI spec §4): [colour, bright core]
const P = {
  gold: ['#FFB627', '#FFE08A'], pink: ['#FF2E97', '#FF8CC6'], violet: ['#9D5CFF', '#C9A6FF'],
  blue: ['#1E7BFF', '#8CC2FF'], teal: ['#14C9B8', '#7FF3E8'], saffron: ['#FF7A1A', '#FFD66B'],
} as const;
type Name = keyof typeof P;
const ORDER: Name[] = ['gold', 'pink', 'violet', 'blue', 'teal', 'saffron'];
const cloud = (cx: number, cy: number, rx: number, ry: number, n: Name): Cloud => ({ cx, cy, rx, ry, colour: P[n][0], core: P[n][1] });

export const BURSTS: Record<string, BurstSpec> = {
  today: { w: 480, h: 360, seed: 3, dots: 190, clouds: [
    cloud(110, 190, 75, 55, 'teal'), cloud(205, 150, 80, 70, 'saffron'), cloud(315, 165, 95, 80, 'pink'),
    cloud(390, 240, 60, 50, 'violet'), cloud(250, 250, 45, 35, 'blue')] },
  done: { w: 500, h: 330, seed: 23, dots: 260, clouds: [
    cloud(95, 170, 80, 60, 'blue'), cloud(185, 150, 75, 70, 'teal'), cloud(255, 120, 80, 75, 'saffron'),
    cloud(355, 150, 95, 80, 'pink'), cloud(440, 200, 60, 50, 'violet')] },
  ...Object.fromEntries(ORDER.map((n, i): [string, BurstSpec] => [`block-${n}`, { w: 260, h: 210, seed: 7 + i, dots: 70, clouds: [
    cloud(120, 100, 55, 45, n), cloud(190, 80, 40, 35, ORDER[(i + 1) % 6]), cloud(170, 150, 35, 28, ORDER[(i + 2) % 6])] }])),
};

if (isMain(import.meta.url)) {
  const dir = join(REPO_ROOT, 'public', 'bursts');
  mkdirSync(dir, { recursive: true });
  for (const [name, spec] of Object.entries(BURSTS)) writeFileSync(join(dir, `${name}.svg`), burstSvg(spec));
  console.log(`wrote ${Object.keys(BURSTS).length} bursts to public/bursts/`);
}
