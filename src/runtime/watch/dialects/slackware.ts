/** @file Slackware fswatch strategy: conservative latency to absorb noisier inotify streams. */
import type { WatchStrategy } from '../types';
import { createFswatchStrategy } from './linux-fswatch/base';

export const SlackwareFswatchStrategy: WatchStrategy = createFswatchStrategy({
  latency: 0.7,
});
