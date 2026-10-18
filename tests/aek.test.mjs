import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseSilenceLog, computeKeeps } from '../scripts/silences.mjs';
import { subtract, parseRanges } from '../scripts/plan.mjs';

const AEK = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'aek.mjs');

function aek(...args) {
  const r = spawnSync('node', [AEK, ...args], { encoding: 'utf8' });
  assert.equal(r.status, 0, `aek ${args.join(' ')} failed: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

test('parseSilenceLog reads start/end pairs and closes a trailing silence', () => {
  const log = [
    '[silencedetect @ 0x1] silence_start: 2',
    '[silencedetect @ 0x1] silence_end: 4 | silence_duration: 2',
    '[silencedetect @ 0x1] silence_start: 6',
  ].join('\n');
  assert.deepEqual(parseSilenceLog(log, 9), [
    { start: 2, end: 4 },
    { start: 6, end: 9 },
  ]);
});

test('computeKeeps pads speech and drops tiny segments', () => {
  const keeps = computeKeeps([{ start: 2, end: 4 }, { start: 6, end: 9 }], 9, { pad: 0.1, minKeep: 0.15 });
  assert.deepEqual(keeps, [
    { start: 0, end: 2.1 },
    { start: 3.9, end: 6.1 },
  ]);
  const tiny = computeKeeps([{ start: 0.05, end: 5 }], 5, { pad: 0.0, minKeep: 0.15 });
  assert.deepEqual(tiny, []);
});

test('computeKeeps handles a silence shorter than twice the padding', () => {
  const keeps = computeKeeps([{ start: 2, end: 2.1 }], 5, { pad: 0.08, minKeep: 0.15 });
  assert.deepEqual(keeps, [{ start: 0, end: 5 }]);
});

test('subtract splits and trims segments', () => {
  const out = subtract([{ start: 0, end: 10 }], parseRanges('2-3,9-12'));
  assert.deepEqual(out, [
    { start: 0, end: 2 },
    { start: 3, end: 9 },
  ]);
});

test('end to end: silences are cut and the render matches the edit list', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'aek-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  // 9 s clip: tone 0-2, silence 2-4, tone 4-6, silence 6-9.
  const src = join(dir, 'fixture.mp4');
  const gen = spawnSync(
    'ffmpeg',
    [
      '-hide_banner', '-y',
      '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=25:duration=9',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=9',
      '-af', "volume=enable='between(t,2,4)+between(t,6,9)':volume=0",
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
      src,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(gen.status, 0, gen.stderr);

  const result = aek('run', src, '--draft');
  assert.ok(existsSync(join(dir, 'renders', 'fixture.edited.mp4')));
  assert.equal(result.plan.segments, 2);
  assert.ok(Math.abs(result.render.actualDuration - result.render.expectedDuration) < 0.25,
    `duration delta too large: ${result.render.durationDelta}`);
  assert.ok(result.render.actualDuration > 3.9 && result.render.actualDuration < 4.7,
    `unexpected output length ${result.render.actualDuration}`);

  const sil = JSON.parse(readFileSync(join(dir, 'renders', 'fixture.silences.json'), 'utf8'));
  assert.equal(sil.silences.length, 2);
});

test('vertical render produces 1080x1920', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'aek-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const src = join(dir, 'wide.mp4');
  const gen = spawnSync(
    'ffmpeg',
    [
      '-hide_banner', '-y',
      '-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=25:duration=4',
      '-f', 'lavfi', '-i', 'sine=frequency=330:duration=4',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
      src,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(gen.status, 0, gen.stderr);
  const result = aek('run', src, '--vertical', '--draft');
  assert.equal(result.render.width, 1080);
  assert.equal(result.render.height, 1920);
});
