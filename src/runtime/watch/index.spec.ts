/** @file Unit tests: strategy selection */
import { FsWatchStrategy as Generic } from './fs-watch';
import { MacOSWatchStrategy as Mac } from './dialects/macos';
import { WindowsWatchStrategy as Win } from './dialects/windows';
import { DebianFswatchStrategy as Deb } from './dialects/debian';
import { RedHatFswatchStrategy as Rh } from './dialects/redhat';
import { SlackwareFswatchStrategy as Sl } from './dialects/slackware';
import { selectLinuxStrategy, selectByPlatformPure } from './dialects/resolve';

describe('watch strategy selection (pure)', () => {
  it('selects macOS and Windows explicitly', () => {
    expect(selectByPlatformPure('darwin', null)).toBe(Mac);
    expect(selectByPlatformPure('win32', null)).toBe(Win);
  });

  it('selects Linux distro families', () => {
    expect(selectLinuxStrategy('debian')).toBe(Deb);
    expect(selectLinuxStrategy('redhat')).toBe(Rh);
    expect(selectLinuxStrategy('slackware')).toBe(Sl);
    expect(selectLinuxStrategy(null)).toBe(Generic);
    expect(selectByPlatformPure('linux', 'debian')).toBe(Deb);
  });
});
