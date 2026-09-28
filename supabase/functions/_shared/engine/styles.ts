import data from './styles.data.json' with { type: 'json' };

export interface RhythmPattern { id: string; name: string; grid: string[]; accents: number[]; verified: boolean; note: string | null }
export interface ProgressionDef { id: string; name: string; roman: string[]; bars: number; verified: boolean }
export interface StyleFeel {
  subdivision: string; meter: string; tempo_range: [number, number]; accents: string;
  swing_ratio: number | null; clave: string | null;
}
export interface StyleProfile {
  id: string; name: string; family: string; feel: StyleFeel;
  rhythm_patterns: RhythmPattern[]; progressions: ProgressionDef[];
  chord_colours: string[]; forms: string[]; fill_vocabulary: string[]; scales: string[];
  keys_common: string[]; tunings: string[]; lyric_traits: string[];
  reference_tracks: { title: string; artist: string; why: string }[];
  transplant_levers: string[]; ladder: string[];
}
export interface StyleElement { id: string; style: string; kind: 'rhythm' | 'progression'; name: string; verified: boolean }
export interface StyleCatalog { profiles: StyleProfile[]; elements: StyleElement[] }

/** A style's elements in ladder order: rhythm patterns first, then progressions. */
export function elementsOf(p: StyleProfile): StyleElement[] {
  return [
    ...p.rhythm_patterns.map(r => ({ id: r.id, style: p.id, kind: 'rhythm' as const, name: r.name, verified: r.verified })),
    ...p.progressions.map(r => ({ id: r.id, style: p.id, kind: 'progression' as const, name: r.name, verified: r.verified })),
  ];
}

export const STYLES = data as unknown as StyleProfile[];
export const STYLE_CATALOG: StyleCatalog = { profiles: STYLES, elements: STYLES.flatMap(elementsOf) };
