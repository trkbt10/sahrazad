/** @file Pure resolver helpers for tests and tools. Not imported by runtime. */
import type { WatchStrategy } from '../types';
import { FsWatchStrategy as GenericFsWatchStrategy } from '../fs-watch';
import { MacOSWatchStrategy } from './macos';
import { WindowsWatchStrategy } from './windows';
import type { LinuxDistroGroup } from './linux-distro';
import { DebianFswatchStrategy } from './debian';
import { RedHatFswatchStrategy } from './redhat';
import { SlackwareFswatchStrategy } from './slackware';

export const selectLinuxStrategy = (group: LinuxDistroGroup | null): WatchStrategy => {
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

export const selectByPlatformPure = (
  platform: NodeJS.Platform,
  distroGroup: LinuxDistroGroup | null,
): WatchStrategy => {
  if (platform === 'darwin') {
    return MacOSWatchStrategy;
  }
  if (platform === 'win32') {
    return WindowsWatchStrategy;
  }
  if (platform === 'linux') {
    return selectLinuxStrategy(distroGroup);
  }
  return GenericFsWatchStrategy;
};

