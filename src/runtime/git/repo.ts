/** @file simple-git backed repository abstraction */
import { resolve } from 'node:path';
import { simpleGit, type SimpleGit } from 'simple-git';
import type { GitRepo } from './types';

function ensureArg<T>(value: T | undefined, name: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Missing required argument: ${name}`);
  }
  return value;
}

/** Create a GitRepo bound to the given root directory. */
export function createGitRepo(rootDir: string): GitRepo {
  const root = resolve(ensureArg(rootDir, 'rootDir'));
  const git: SimpleGit = simpleGit({ baseDir: root });

  async function currentBranch(): Promise<string> {
    const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
    return branch.trim();
  }

  async function headCommit(): Promise<string> {
    const hash = await git.revparse(['HEAD']);
    return hash.trim();
  }

  async function status() {
    return git.status();
  }

  async function add(paths: string | string[]): Promise<void> {
    if (Array.isArray(paths)) {
      await git.add(paths);
      return;
    }
    await git.add([paths]);
  }

  async function commit(message: string, paths?: string | string[]) {
    if (paths !== undefined) {
      await add(paths);
    }
    return git.commit(message);
  }

  async function revParse(arg: string): Promise<string> {
    if (!arg) {
      throw new Error('revParse requires a non-empty arg');
    }
    const out = await git.revparse([arg]);
    return out.trim();
  }

  return {
    root,
    git,
    currentBranch,
    headCommit,
    status,
    add,
    commit,
    revParse,
  };
}
