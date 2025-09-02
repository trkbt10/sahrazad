/** @file Unit tests for git watcher helpers */
import { ensureOptions, emitOrThrow, resolveBranchHash, refreshHeadState } from './watcher';
import { join } from 'node:path';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';

describe('git watcher helpers', () => {
  it('ensureOptions applies defaults and validates input', () => {
    expect(() => ensureOptions(undefined)).toThrow();
    const o = ensureOptions({});
    expect(o.debounceMs).toBe(100);
    expect(o.enrich).toBe(true);
    const o2 = ensureOptions({ debounceMs: 5, enrich: false });
    expect(o2.debounceMs).toBe(5);
    expect(o2.enrich).toBe(false);
  });

  it('emitOrThrow calls onError when provided, otherwise throws', () => {
    const errors: unknown[] = [];
    const onError = (e: unknown): void => {
      errors.push(e);
    };
    emitOrThrow(onError, new Error('x'));
    expect(errors.length).toBe(1);
    expect(() => emitOrThrow(undefined, new Error('y'))).toThrow();
  });

  it('resolveBranchHash prefers file content and falls back to rev-parse', async () => {
    const root = mkdtempSync(join(tmpdir(), 'git-watcher-unit-'));
    try {
      const refPath = join(root, 'ref');
      writeFileSync(refPath, 'abc123\n');
      const res1 = await resolveBranchHash(
        { revParse: async () => 'zz' },
        'main',
        refPath,
        1,
        { t: null },
      );
      expect(res1.ok).toBe(true);
      if (res1.ok) {
        expect(res1.hash).toBe('abc123');
      }

      // When file read fails, fallback to rev-parse
      const res2 = await resolveBranchHash(
        { revParse: async () => 'revhash' },
        'main',
        join(root, 'missing'),
        1,
        { t: null },
      );
      expect(res2.ok).toBe(true);
      if (res2.ok) {
        expect(res2.hash).toBe('revhash');
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refreshHeadState sets headRefPath from HEAD ref and handles detached head', async () => {
    const root = mkdtempSync(join(tmpdir(), 'git-watcher-head-'));
    try {
      const gitDir = join(root, '.git');
      const refsHeads = join(gitDir, 'refs', 'heads');
      mkdirSync(refsHeads, { recursive: true });
      const headRef = 'refs/heads/test';
      const headFile = join(gitDir, 'HEAD');
      writeFileSync(headFile, `ref: ${headRef}\n`);

      const state = { headRefPath: null as string | null };
      await refreshHeadState(state, root);
      expect(state.headRefPath).toBe(join(root, '.git', headRef));

      // Detached head
      writeFileSync(headFile, 'deadbeef\n');
      await refreshHeadState(state, root);
      expect(state.headRefPath).toBe(null);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

