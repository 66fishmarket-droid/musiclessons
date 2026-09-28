import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildGraph, moduleNames, renderGraph } from '../../scripts/vault-sync-code.ts';

const root = join(import.meta.dirname, '..', 'fixtures', 'codegraph');
const graph = buildGraph(root, { testSuffix: '.check.ts' });
const fn = (id: string) => graph.fns.find(f => f.id === id)!;

describe('buildGraph', () => {
  it('finds top-level functions and arrow functions with JSDoc summaries', () => {
    expect(graph.fns.map(f => f.id).sort()).toEqual(
      ['lib.addOne', 'lib.helper', 'lib.tested', 'lib.twinA', 'lib.twinB', 'lib.unused', 'run.main']);
    expect(fn('lib.helper').summary).toBe('Adds one via a private helper.');
    expect(fn('lib.helper').signature).toBe('helper(n: number)');
    expect(fn('lib.helper').layer).toBe('ui'); // fixture uses src/
  });
  it('resolves calls and callers through imports', () => {
    expect([...fn('lib.helper').calls]).toEqual(['lib.addOne']);
    expect([...fn('lib.addOne').calledBy]).toEqual(['lib.helper']);
    expect([...fn('lib.helper').calledBy]).toEqual(['run.main']);
    expect([...fn('run.main').calledBy]).toEqual(['action.run']);
  });
  it('builds an action hub for script entry files with everything reachable', () => {
    const action = graph.actions.find(a => a.id === 'action.run')!;
    expect(action.handlers).toEqual(['run.main']);
    expect(action.reaches).toEqual(['lib.addOne', 'lib.helper', 'run.main']);
  });
  it('flags tests, dead code and duplicates', () => {
    expect(fn('lib.tested').testedBy).toEqual(['lib.check.ts']);
    expect(fn('lib.twinA').duplicates).toBe(1);
    expect(fn('lib.helper').duplicates).toBe(0);
  });
});

describe('moduleNames', () => {
  it('uses the folder for index files and disambiguates collisions', () => {
    const m = moduleNames(['supabase/functions/ask/index.ts', 'src/a/util.ts', 'scripts/util.ts', 'src/planner.ts']);
    expect(m.get('supabase/functions/ask/index.ts')).toBe('ask');
    expect(m.get('src/a/util.ts')).toBe('a.util');
    expect(m.get('scripts/util.ts')).toBe('scripts.util');
    expect(m.get('src/planner.ts')).toBe('planner');
  });
});

describe('renderGraph', () => {
  const notes = renderGraph(graph, '2026-09-28');
  const byPath = (p: string) => notes.find(n => n.path === p)!;
  it('writes one note per function under its file folder with Bill-compatible keys', () => {
    const n = byPath('Codebase/src/lib/lib.helper.md');
    expect(n.frontmatter).toMatchObject({
      generated: true, kind: 'function', file: 'src/lib.ts', parent: '[[lib]]',
      calls: ['[[lib.addOne]]'], called_by: ['[[run.main]]'], dead_candidate: false, test_only: false,
    });
    expect(n.frontmatter.tags).toEqual(['code/ts', 'layer/ui', 'kind/function', 'visibility/public']);
  });
  it('marks dead and test-only functions', () => {
    expect(byPath('Codebase/src/lib/lib.unused.md').frontmatter.dead_candidate).toBe(true);
    expect(byPath('Codebase/src/lib/lib.tested.md').frontmatter.test_only).toBe(true);
  });
  it('writes a hub per file and an action note per entry', () => {
    expect(byPath('Codebase/src/lib.md').body).toContain('- [[lib.helper]] — Adds one via a private helper.');
    expect(byPath('Codebase/_actions/action.run.md').frontmatter).toMatchObject({ kind: 'action', action_kind: 'script', handlers: ['[[run.main]]'] });
  });
});
