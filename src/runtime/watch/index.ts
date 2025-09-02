/** @file Public exports and platform-aware strategy selection */
export * from './types';

import type { WatchStrategy } from './types';
import { FsWatchStrategy as GenericFsWatchStrategy } from './fs-watch';
import { MacOSWatchStrategy } from './dialects/macos';
import { WindowsWatchStrategy } from './dialects/windows';
import { detectLinuxDistroGroup, type LinuxDistroGroup } from './dialects/linux-distro';
import { DebianFswatchStrategy } from './dialects/debian';
import { RedHatFswatchStrategy } from './dialects/redhat';
import { SlackwareFswatchStrategy } from './dialects/slackware';

const selectLinuxStrategy = (group: LinuxDistroGroup | null): WatchStrategy => {
  if (group === 'debian') {
    return DebianFswatchStrategy;
  }
  if (group === 'redhat') {
    return RedHatFswatchStrategy;
  }
  if (group === 'slackware') {
    return SlackwareFswatchStrategy;
  }
  return GenericFsWatchStrategy;
};

const selectByPlatform = (platform: NodeJS.Platform): WatchStrategy => {
  if (platform === 'darwin') {
    return MacOSWatchStrategy;
  }
  if (platform === 'win32') {
    return WindowsWatchStrategy;
  }
  if (platform === 'linux') {
    const group = detectLinuxDistroGroup('/etc/os-release');
    return selectLinuxStrategy(group);
  }
  return GenericFsWatchStrategy;
};

export const FsWatchStrategy: WatchStrategy = selectByPlatform(process.platform);
