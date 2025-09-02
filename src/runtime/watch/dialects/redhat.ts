/** @file RedHat-family fswatch strategy: slightly higher latency for coarser events. */
import type { WatchStrategy } from '../types';
import { createFswatchStrategy } from './linux-fswatch/base';

export const RedHatFswatchStrategy: WatchStrategy = createFswatchStrategy({
  latency: 0.6,
});
