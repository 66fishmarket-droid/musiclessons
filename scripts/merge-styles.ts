/**
 * Merges the style research drafts (Music_Lessons Vault/Research/styles/*.draft.json) into
 * supabase/functions/_shared/engine/styles.data.json with one schema, canonical numerals and verified flags.
 *   node scripts/merge-styles.ts
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Scale } from 'tonal';
import { normalizeRoman, romanToChords } from '../supabase/functions/_shared/engine/roman.ts';
import type { ProgressionDef, RhythmPattern, StyleProfile } from '../supabase/functions/_shared/engine/styles.ts';
import { REPO_ROOT, VAULT, isMain } from './vault/lib.ts';

export const FAMILY: Record<string, string> = {
  folk: 'folk_roots', americana: 'folk_roots', celtic: 'folk_roots', blues: 'blues', funk: 'funk',
  soul: 'soul_rnb', neo_soul: 'soul_rnb', country: 'country', bluegrass: 'country', jazz_swing: 'jazz',
  gypsy_jazz: 'jazz', rock_classic: 'rock', rock_hard: 'rock', rock_indie_alt: 'rock', punk: 'rock',
  pop_punk: 'rock', metal: 'rock', pop: 'pop', pop_rock: 'pop', reggae: 'caribbean', bossa_samba: 'latin_iberian',
  son_salsa: 'latin_iberian', rumba_flamenca: 'latin_iberian', west_african: 'african',
};
/** Patterns the research agents reported as their own transcriptions (style|name). */
export const INFERRED_PATTERNS = new Set([
  'folk|Drone 3-3-2 arpeggio', 'funk|Syncopated stabs', 'funk|Single-note 16th riff (Nolen)',
  'soul|Cropper push', 'soul|16th soul comp', 'country|Train beat (palm-muted)', 'americana|Neil Young medium strum',
  'celtic|Reel syncopated up-accent', 'celtic|Waltz rolling strum (3/4, 12 slots)', 'jazz_swing|Offbeat stabs',
  'gypsy_jazz|Valse musette (3/4, 12 slots)', 'neo_soul|Backbeat stab', 'neo_soul|Kick-follow staccato',
  'neo_soul|Ghost-scratch 16ths', 'pop|Syncopated 16th push', 'pop_rock|Wonderwall-style 16th strum',
  'rock_indie_alt|Chord + muted scratch', 'soul|12/8 gospel ballad (swing to triplets)',
]);
/** Progressions recalled rather than sourced (style|original numerals). */
export const INFERRED_PROGRESSIONS = new Set(['son_salsa|im bIII ivm V']);
/** Numeral corrections (style|original numerals → fixed). */
export const PROGRESSION_FIXES: Record<string, string[]> = { 'west_african|I VII IV V': ['I', 'bVII', 'IV', 'V'] };
const TOKEN_MAP: Record<string, string> = { T: 'B', F: 'P' };
const TOKEN = /^(D|U|d|u|M|m|B|P|BP|N|x|5|6|l|c|n|h|-)$/;
const GRID_LENGTHS = [12, 16, 24, 32];

/** snake_case id fragment from a display name. */
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

/** Palm-muted pattern: strums become M/m (palm-muted down/up) in place, except the slots listed as ringing open. */
function palmMute(grid: string[], open: number[]): void {
  grid.forEach((t, k) => { if (!open.includes(k)) grid[k] = t === 'D' ? 'M' : t === 'U' ? 'm' : t; });
}

/** Normalises raw drafts into StyleProfiles and lists every validation problem found. */
export function mergeProfiles(drafts: unknown[]): { profiles: StyleProfile[]; issues: string[] } {
  const issues: string[] = [];
  const profiles = (drafts as Record<string, any>[]).map(d => {
    const id = String(d.id);
    const family = FAMILY[id] ?? (d.family ? String(d.family) : undefined); // spec §3 families win over agent slugs
    if (!family) issues.push(`${id}: no family`);
    const f = d.feel ?? {};
    const swing = typeof f.swing_ratio === 'number' ? f.swing_ratio
      : typeof f.swing === 'number' ? Math.round((f.swing / (1 - f.swing)) * 100) / 100 : null;
    const rhythm_patterns: RhythmPattern[] = (d.rhythm_patterns ?? []).map((p: any) => {
      const raw = String(p.grid16 ?? p.grid ?? '');
      const grid = (/\s/.test(raw.trim()) ? raw.trim().split(/\s+/) : raw.split('')).map(t => TOKEN_MAP[t] ?? t);
      const pid = `${id}.${slug(p.name)}`;
      if (p.palm_mute) palmMute(grid, Array.isArray(p.accents) && /open|un-muted/i.test(`${p.name} ${p.note ?? ''}`) ? p.accents : []);
      if (!GRID_LENGTHS.includes(grid.length)) issues.push(`${pid}: grid length ${grid.length}`);
      const bad = [...new Set(grid.filter(t => !TOKEN.test(t)))];
      if (bad.length) issues.push(`${pid}: bad tokens ${bad.join('')}`);
      const verified = p.confidence ? p.confidence === 'sourced' : !INFERRED_PATTERNS.has(`${id}|${p.name}`);
      return { id: pid, name: String(p.name), grid, accents: Array.isArray(p.accents) ? p.accents : [], verified, note: p.note ?? p.grid_note ?? null, ...(typeof p.push === 'number' ? { push: p.push } : {}) };
    });
    const progressions: ProgressionDef[] = (d.progressions ?? []).map((p: any) => {
      const original = strings(p.roman).flatMap(r => r.trim().split(/\s+/));
      const key = `${id}|${original.join(' ')}`;
      const pid = `${id}.prog_${slug(p.name)}`;
      let roman = PROGRESSION_FIXES[key] ?? original;
      try { romanToChords('C', roman); roman = roman.map(normalizeRoman); }
      catch (e) { issues.push(`${pid}: ${(e as Error).message}`); }
      return { id: pid, name: String(p.name), roman, bars: Number(p.bars ?? roman.length), verified: !INFERRED_PROGRESSIONS.has(key) };
    });
    for (const sc of strings(d.scales)) if (Scale.get(`C ${sc}`).empty) issues.push(`${id}: unknown scale "${sc}"`);
    const profile: StyleProfile = {
      id, name: String(d.name), family: family ?? 'unknown',
      feel: {
        subdivision: String(f.subdivision ?? ''), meter: String(f.meter ?? '4/4'),
        tempo_range: [Number(f.tempo_range?.[0] ?? 60), Number(f.tempo_range?.[1] ?? 120)],
        accents: Array.isArray(f.accents) ? f.accents.join('; ') : String(f.accents ?? ''),
        swing_ratio: swing, clave: f.clave?.name ?? (typeof f.clave === 'string' ? f.clave : null),
      },
      rhythm_patterns, progressions,
      chord_colours: strings(d.chord_colours), forms: strings(d.forms), fill_vocabulary: strings(d.fill_vocabulary),
      scales: strings(d.scales), keys_common: strings(d.keys_common), tunings: strings(d.tunings),
      lyric_traits: strings(d.lyric_traits),
      reference_tracks: (d.reference_tracks ?? []).map((t: any) => ({ title: String(t.title), artist: String(t.artist), why: String(t.why ?? '') })),
      transplant_levers: strings(d.transplant_levers), ladder: strings(d.ladder).length ? strings(d.ladder) : [],
    };
    return profile;
  });
  const ids = profiles.flatMap(p => [p.id, ...p.rhythm_patterns.map(r => r.id), ...p.progressions.map(r => r.id)]);
  for (const dup of new Set(ids.filter((x, i) => ids.indexOf(x) !== i))) issues.push(`duplicate id ${dup}`);
  return { profiles, issues };
}

function main(): void {
  const dir = join(VAULT, 'Research', 'styles');
  const drafts = readdirSync(dir).filter(f => f.endsWith('.draft.json')).sort()
    .flatMap(f => JSON.parse(readFileSync(join(dir, f), 'utf8')) as unknown[]);
  const { profiles, issues } = mergeProfiles(drafts);
  if (issues.length) { console.error(issues.join('\n')); process.exit(1); }
  const out = join(REPO_ROOT, 'supabase/functions/_shared/engine/styles.data.json');
  writeFileSync(out, `${JSON.stringify(profiles, null, 2)}\n`);
  const patterns = profiles.flatMap(p => p.rhythm_patterns);
  console.log(`${profiles.length} styles, ${patterns.length} patterns (${patterns.filter(p => p.verified).length} verified) → ${out}`);
}

if (isMain(import.meta.url)) main();
