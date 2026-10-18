import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, fail } from './lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HERK_URL = 'https://github.com/nateherkai/herk-edit-kit.git';

/**
 * Clone (or update) Herk Edit Kit into vendor/. It is optional and only adds
 * captions, motion-graphics cards and its own editing skills. The downloaded
 * code is untrusted: nothing in it is executed unless `install` is passed.
 */
export function setup(flags = {}) {
  const target = resolve(flags.dir && flags.dir !== true ? flags.dir : join(ROOT, 'vendor', 'herk-edit-kit'));
  mkdirSync(dirname(target), { recursive: true });

  let action;
  if (existsSync(join(target, '.git'))) {
    const r = run('git', ['-C', target, 'pull', '--ff-only']);
    if (r.code !== 0) fail(`git pull failed: ${r.stderr.trim()}`);
    action = 'updated';
  } else {
    const r = run('git', ['clone', '--depth', '1', HERK_URL, target]);
    if (r.code !== 0) fail(`git clone failed: ${r.stderr.trim()}`);
    action = 'cloned';
  }

  const rev = run('git', ['-C', target, 'rev-parse', '--short', 'HEAD']).stdout.trim();
  const result = { action, path: target, commit: rev, installed: false };

  if (flags.install) {
    const r = run('npm', ['ci'], { cwd: target });
    if (r.code !== 0) fail(`npm ci failed in ${target}: ${r.stderr.trim().split('\n').slice(-3).join(' | ')}`);
    result.installed = true;
  }
  return result;
}
