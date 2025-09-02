/** @file Helpers to parse and read .git/HEAD */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { GitHeadInfo } from './types';

const HEAD_FILE = 'HEAD';

/** Parse the content of .git/HEAD into a discriminated union. */
export function parseHeadContent(content: string): GitHeadInfo {
  const text = content.trim();
  if (text.startsWith('ref:')) {
    const ref = text.replace(/^ref:\s*/, '').trim();
    return { kind: 'ref', ref };
  }
  return { kind: 'hash', hash: text };
}

/** Read the current HEAD info from a repo root. */
export async function readHeadInfo(repoRoot: string): Promise<GitHeadInfo> {
  const headPath = join(repoRoot, '.git', HEAD_FILE);
  const content = await readFile(headPath, 'utf8');
  return parseHeadContent(content);
}
