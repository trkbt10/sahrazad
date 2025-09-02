/** @file Unit tests for git repo abstraction (uses vitest globals) */
import { createGitRepo } from './repo';

describe('createGitRepo', () => {
  it('throws when rootDir is missing', () => {
    // @ts-expect-error intentionally missing argument
    expect(() => createGitRepo()).toThrowError();
  });

  it('creates repo with resolved root', () => {
    const repo = createGitRepo('.');
    expect(repo.root.length > 0).toBe(true);
    expect(typeof repo.currentBranch).toBe('function');
  });
});
