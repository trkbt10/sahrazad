/** @file Unit tests for HEAD parsing (uses vitest globals) */
import { parseHeadContent } from './head';

describe('parseHeadContent', () => {
  it('parses ref form', () => {
    const info = parseHeadContent('ref: refs/heads/main\n');
    expect(info).toEqual({ kind: 'ref', ref: 'refs/heads/main' });
  });

  it('parses detached hash form', () => {
    const hash = 'a1b2c3d4e5f6g7h8i9j0';
    const info = parseHeadContent(`${hash}\n`);
    expect(info).toEqual({ kind: 'hash', hash });
  });
});
