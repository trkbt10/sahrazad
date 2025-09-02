/** @file Unit tests: linux distro detector */
import { detectLinuxDistroGroup } from './linux-distro';
import { join } from 'node:path';

describe('detectLinuxDistroGroup()', () => {
  it('detects Debian family via ID and ID_LIKE', () => {
    const p = join(__dirname, '__fixtures__', 'ubuntu.os-release');
    expect(detectLinuxDistroGroup(p)).toBe('debian');
  });

  it('detects RedHat family', () => {
    const p = join(__dirname, '__fixtures__', 'fedora.os-release');
    expect(detectLinuxDistroGroup(p)).toBe('redhat');
  });

  it('detects Slackware', () => {
    const p = join(__dirname, '__fixtures__', 'slackware.os-release');
    expect(detectLinuxDistroGroup(p)).toBe('slackware');
  });

  it('returns null for unknown', () => {
    const p = join(__dirname, '__fixtures__', 'arch.os-release');
    expect(detectLinuxDistroGroup(p)).toBe(null);
  });
});
