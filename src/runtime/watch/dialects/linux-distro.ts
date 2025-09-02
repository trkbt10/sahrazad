/** @file Linux distro detection for watcher selection. */
import { readFileSync } from 'node:fs';

export type LinuxDistroGroup = 'debian' | 'redhat' | 'slackware';

const parseOsRelease = (content: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const idx = line.indexOf('=');
    if (idx <= 0) {
      continue;
    }
    const key = line.slice(0, idx).trim();
    const raw = line.slice(idx + 1).trim();
    const val = raw.replace(/^"|"$/g, '');
    out[key] = val;
  }
  return out;
};

const classify = (id: string, idLike: string[]): LinuxDistroGroup | null => {
  const needlesDeb = new Set(['debian', 'ubuntu', 'linuxmint', 'raspbian', 'kali']);
  const needlesRhel = new Set(['rhel', 'redhat', 'centos', 'fedora', 'rocky', 'almalinux']);
  const needlesSlack = new Set(['slackware']);

  const all = new Set<string>([id, ...idLike]);
  for (const n of all) {
    if (needlesDeb.has(n)) {
      return 'debian';
    }
    if (needlesRhel.has(n)) {
      return 'redhat';
    }
    if (needlesSlack.has(n)) {
      return 'slackware';
    }
  }
  return null;
};

export const detectLinuxDistroGroup = (osReleasePath: string): LinuxDistroGroup | null => {
  try {
    const txt = readFileSync(osReleasePath, 'utf8');
    const kv = parseOsRelease(txt);
    const id = typeof kv.ID === 'string' ? kv.ID.toLowerCase() : '';
    const likeRaw = typeof kv.ID_LIKE === 'string' ? kv.ID_LIKE.toLowerCase() : '';
    const idLike = likeRaw.split(/\s+/).filter((s) => s.length > 0);
    return classify(id, idLike);
  } catch {
    return null;
  }
};

// internal helpers (parseOsRelease, classify) intentionally not exported to avoid API surface
