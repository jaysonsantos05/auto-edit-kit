import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function version(cmd, args = ['-version']) {
  const r = run(cmd, args);
  if (r.error || r.code !== 0) return null;
  return (r.stdout || r.stderr).split('\n')[0].trim();
}

export function doctor() {
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const chrome = ['google-chrome', 'chromium', 'chromium-browser', 'chrome']
    .map((c) => ({ c, v: version(c, ['--version']) }))
    .find((x) => x.v);

  const checks = [
    { name: 'node', required: true, ok: nodeMajor >= 22, detail: `v${process.versions.node} (need 22+)` },
    { name: 'ffmpeg', required: true, ok: Boolean(version('ffmpeg')), detail: version('ffmpeg') || 'not found' },
    { name: 'ffprobe', required: true, ok: Boolean(version('ffprobe')), detail: version('ffprobe') || 'not found' },
    { name: 'git', required: false, ok: Boolean(version('git', ['--version'])), detail: version('git', ['--version']) || 'not found (needed for setup)' },
    { name: 'chrome', required: false, ok: Boolean(chrome), detail: chrome ? chrome.v : 'not found (only needed for HyperFrames motion graphics)' },
    {
      name: 'herk-edit-kit',
      required: false,
      ok: existsSync(join(ROOT, 'vendor', 'herk-edit-kit')),
      detail: existsSync(join(ROOT, 'vendor', 'herk-edit-kit')) ? 'vendor/herk-edit-kit present' : 'not installed (run: aek setup)',
    },
  ];
  return { checks, ready: checks.filter((c) => c.required).every((c) => c.ok) };
}
