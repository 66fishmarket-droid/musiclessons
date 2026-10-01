/**
 * Writes docs/glossary-review.md: every glossary entry in order, then every recipe (rendered in G) with the
 * terms it would show, so recipes with no terms or undefined jargon stand out.
 *   node scripts/render-glossary.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GLOSSARY, termsIn } from '../supabase/functions/_shared/engine/glossary.ts';
import { buildMusic } from '../supabase/functions/_shared/engine/music.ts';
import { targetFor } from '../supabase/functions/_shared/engine/planner.ts';
import { RECIPES } from '../supabase/functions/_shared/engine/recipes.ts';
import { renderSteps, slotContext } from '../supabase/functions/_shared/engine/render.ts';
import type { LessonPlan } from '../supabase/functions/_shared/engine/types.ts';
import { SKILLS } from '../supabase/seed/curriculum.ts';
import { REPO_ROOT } from './vault/lib.ts';

const out = ['# Glossary review', '', `${GLOSSARY.length} terms, in the order definitions build up.`, ''];
GLOSSARY.forEach((g, i) => out.push(`${i + 1}. **${g.term}** — ${g.plain}`, `   *Why it works:* ${g.why}`, `   _match: ${g.match.join(', ')}_`, ''));
out.push('## Terms per recipe (key of G)', '');
for (const s of SKILLS.filter(x => x.track !== 'theory')) {
  const r = RECIPES[s.id];
  if (!r) continue;
  const plan = { key: 'G', music: buildMusic({ key: 'G', track: s.track, style: null, element: null }) } as unknown as LessonPlan;
  const ctx = slotContext(plan, { target: targetFor(s), patternId: r.patterns?.[0] ?? null, grid: r.grid ?? null, gridName: r.gridName ?? null });
  const terms = termsIn([...renderSteps(r.steps, ctx), r.listenFor]).map(t => t.term);
  out.push(`- **${s.name}** (${s.id}): ${terms.length ? terms.join(', ') : '⚠️ none'}`);
}
writeFileSync(join(REPO_ROOT, 'docs', 'glossary-review.md'), `${out.join('\n')}\n`);
console.log(`docs/glossary-review.md: ${GLOSSARY.length} terms`);
