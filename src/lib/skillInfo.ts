import { PATTERNS, SKILL_PATTERNS, type PickPattern } from '../../supabase/functions/_shared/engine/patterns.ts';
import { SKILL_GUIDES, type SkillGuide } from '../../supabase/functions/_shared/engine/skillGuides.ts';
import type { Skill } from '../../supabase/functions/_shared/engine/types.ts';
import { SKILLS } from '../../supabase/seed/curriculum.ts';

/** Everything the "About this skill" sheet shows: the curriculum row, its guide (if written) and its picking patterns. */
export function skillInfo(id: string): { skill: Skill; guide: SkillGuide | null; patterns: PickPattern[] } | null {
  const skill = SKILLS.find(s => s.id === id);
  if (!skill) return null;
  return { skill, guide: SKILL_GUIDES[id] ?? null, patterns: (SKILL_PATTERNS[id] ?? []).map(p => PATTERNS[p]) };
}
