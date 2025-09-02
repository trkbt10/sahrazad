/** @file Integration test: watchGit reacts to real fs.watch signals using shared strategy. */
import { join } from 'node:path';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';
import envPaths from 'env-paths';
import { simpleGit } from 'simple-git';
import { createGitRepo, watchGit } from '../src/runtime/git';
import { FsWatchStrategy } from '../src/runtime/watch';

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const uniqueTemp = (scope: string): string => {
  const base = envPaths('shrzad-tests').temp;
  const dir = join(base, `${scope}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
};

describe('watchGit with real FsWatchStrategy', () => {
  it('detects HEAD, ref, and index changes on a real repo', async () => {
    const root = uniqueTemp('git-watcher-int');
    try {
      const git = simpleGit({ baseDir: root });
      await git.init();
      await git.addConfig('user.name', 'bot');
      await git.addConfig('user.email', 'bot@example.com');
      // initial commit on default branch
      writeFileSync(join(root, 'README.md'), '# Test\n');
      await git.add(['README.md']);
      await git.commit('init');

      const repo = createGitRepo(root);
      const counters = { head: 0, ref: 0, index: 0 };
      const last = { branch: '', hash: '' };
      const stop = await new Promise<ReturnType<typeof watchGit>>((resolveStop) => {
        const s = watchGit(
          repo,
          { debounceMs: 10, enrich: true },
          {
            onHead: () => {
              counters.head = counters.head + 1;
            },
            onRef: (branch, hash) => {
              counters.ref = counters.ref + 1;
              last.branch = branch;
              last.hash = hash ?? '';
            },
            onIndex: () => {
              counters.index = counters.index + 1;
            },
            onReady: () => {
            resolveStop(s);
            },
          },
          FsWatchStrategy,
      );
      });

      // Change HEAD by creating and checking out a new branch
      await git.checkoutLocalBranch('feat/x');
      await wait(50);
      expect(counters.head).toBeGreaterThan(0);

      // Update ref by committing on the current branch
      writeFileSync(join(root, 'file.txt'), 'x');
      await git.add(['file.txt']);
      await git.commit('update');
      await wait(50);
      expect(counters.ref).toBeGreaterThan(0);
      expect(last.branch.length).toBeGreaterThan(0);
      expect(last.hash.length).toBeGreaterThan(0);

      // Touch index via staging another change
      writeFileSync(join(root, 'file2.txt'), 'y');
      await git.add(['file2.txt']);
      await wait(50);
      expect(counters.index).toBeGreaterThan(0);

      await stop();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
