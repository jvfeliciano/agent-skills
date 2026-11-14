import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let cachedRootVersion: string | null = null;

function readVersionFrom(dir: string): string | null {
  const pj = join(dir, 'plugin.json');
  if (!existsSync(pj)) return null;
  try {
    const parsed = JSON.parse(readFileSync(pj, 'utf8')) as { version?: unknown };
    return typeof parsed.version === 'string' && parsed.version.trim() ? parsed.version.trim() : null;
  } catch {
    return null;
  }
}

/** Resolve the active agent-skills version from plugin.json. */
export function resolveAgentSkillsVersion(cwd?: string): string {
  if (cwd) {
    const fromCwd = readVersionFrom(cwd);
    if (fromCwd) return fromCwd;
  }
  if (!cachedRootVersion) {
    cachedRootVersion = readVersionFrom(PLUGIN_ROOT) || 'unknown';
  }
  return cachedRootVersion;
}
