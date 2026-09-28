import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderNote, syncNotes, type Note } from '../../scripts/vault/lib.ts';

let vault: string;
beforeEach(() => { vault = mkdtempSync(join(tmpdir(), 'vault-')); });
const note = (path: string, body = 'hello', synced = '2026-09-28'): Note =>
  ({ path, frontmatter: { generated: true, synced, tags: ['a', 'b'], count: 2, link: '[[x]]' }, body });

describe('renderNote', () => {
  it('writes YAML frontmatter with quoted strings and block lists', () => {
    expect(renderNote(note('Codebase/a.md'))).toBe(
      '---\ngenerated: true\nsynced: "2026-09-28"\ntags:\n  - "a"\n  - "b"\ncount: 2\nlink: "[[x]]"\n---\n\nhello\n');
  });
  it('renders empty arrays inline', () => {
    expect(renderNote({ path: 'x.md', frontmatter: { calls: [] }, body: '' })).toContain('calls: []');
  });
});

describe('syncNotes', () => {
  it('writes new notes and reports unchanged ones, ignoring the synced date', () => {
    expect(syncNotes(vault, 'Codebase', [note('Codebase/a.md')])).toEqual({ written: 1, unchanged: 0, pruned: 0 });
    expect(syncNotes(vault, 'Codebase', [note('Codebase/a.md', 'hello', '2026-10-01')])).toEqual({ written: 0, unchanged: 1, pruned: 0 });
  });
  it('prunes generated notes that are no longer produced, never hand-written ones or _notes/', () => {
    syncNotes(vault, 'Codebase', [note('Codebase/a.md'), note('Codebase/b.md')]);
    writeFileSync(join(vault, 'Codebase/hand.md'), 'my own note');
    mkdirSync(join(vault, 'Codebase/_notes'));
    writeFileSync(join(vault, 'Codebase/_notes/keep.md'), '---\ngenerated: true\n---\n');
    const stats = syncNotes(vault, 'Codebase', [note('Codebase/a.md')]);
    expect(stats.pruned).toBe(1);
    expect(existsSync(join(vault, 'Codebase/b.md'))).toBe(false);
    expect(readFileSync(join(vault, 'Codebase/hand.md'), 'utf8')).toBe('my own note');
    expect(existsSync(join(vault, 'Codebase/_notes/keep.md'))).toBe(true);
  });
  it('refuses to write outside the managed folder or into _notes', () => {
    expect(() => syncNotes(vault, 'Codebase', [note('Styles/x.md')])).toThrow(/outside/);
    expect(() => syncNotes(vault, 'Codebase', [note('Codebase/_notes/x.md')])).toThrow(/outside/);
  });
  it('dry run writes and deletes nothing', () => {
    syncNotes(vault, 'Codebase', [note('Codebase/a.md')]);
    const stats = syncNotes(vault, 'Codebase', [note('Codebase/c.md')], { dryRun: true });
    expect(stats).toEqual({ written: 1, unchanged: 0, pruned: 1 });
    expect(existsSync(join(vault, 'Codebase/a.md'))).toBe(true);
    expect(existsSync(join(vault, 'Codebase/c.md'))).toBe(false);
  });
});
