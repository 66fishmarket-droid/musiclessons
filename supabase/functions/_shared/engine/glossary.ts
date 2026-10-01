/** One music term explained for a total beginner; GLOSSARY is ordered so each definition only leans on earlier ones. */
export interface GlossaryEntry {
  id: string;
  term: string;
  /** Lower-case words/phrases that trigger this entry (list plurals and verb forms explicitly). */
  match: string[];
  plain: string;
  why: string;
  /** Where the definition was checked (vault Research/glossary/<id>.md); never shown in the app. */
  sources: string[];
}

// Foundations first. Task 4 replaces these two seed entries with researched text and adds the rest.
export const GLOSSARY: GlossaryEntry[] = [
  {
    id: 'half_step', term: 'Half step', match: ['half step', 'half steps', 'semitone', 'semitones'],
    plain: 'The smallest gap between two notes in Western music: one fret on the guitar.',
    why: 'Every scale and chord is built by counting these small gaps.',
    sources: ['seed: replaced in Task 4'],
  },
  {
    id: 'whole_step', term: 'Whole step', match: ['whole step', 'whole steps'],
    plain: 'Two half steps together: two frets on the guitar.',
    why: 'Scales are recipes of whole and half steps; the major scale is W-W-H-W-W-W-H.',
    sources: ['seed: replaced in Task 4'],
  },
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Glossary entries whose words appear in `texts`, longest phrase first, de-duplicated, in order of first appearance. */
export function termsIn(texts: string[], glossary: GlossaryEntry[] = GLOSSARY): GlossaryEntry[] {
  const byMatch = new Map(glossary.flatMap(g => g.match.map(m => [m, g] as const)));
  if (byMatch.size === 0) return [];
  const words = [...byMatch.keys()].sort((a, b) => b.length - a.length).map(escape).join('|');
  const re = new RegExp(`(?<![\\w'-])(${words})(?![\\w'-])`, 'gi');
  const found: GlossaryEntry[] = [];
  for (const text of texts) {
    for (const m of text.replace(/\{[^}]*\}/g, ' ').matchAll(re)) {
      const g = byMatch.get(m[1].toLowerCase());
      if (g && !found.includes(g)) found.push(g);
    }
  }
  return found;
}
