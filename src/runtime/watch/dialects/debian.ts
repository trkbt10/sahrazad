/** @file Debian-family fswatch strategy: tuned latency for inotify burst smoothing. */
import type { WatchStrategy } from '../types';
import { createFswatchStrategy } from './linux-fswatch/base';

export const DebianFswatchStrategy: WatchStrategy = createFswatchStrategy({
  latency: 0.4,
});
