import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { run, probe, fail, num, round } from './lib.mjs';

/** Build the ffmpeg filter graph that trims each segment and concatenates them. */
export function buildFilterGraph(segments, { hasVideo, hasAudio, vertical = false }) {
  const parts = [];
  const concatInputs = [];
  const fade = 0.01; // tiny audio fades stop clicks at cut points

  segments.forEach((seg, i) => {
    const dur = seg.end - seg.start;
    if (hasVideo) {
      parts.push(`[0:v]trim=start=${seg.start}:end=${seg.end},setpts=PTS-STARTPTS[v${i}]`);
      concatInputs.push(`[v${i}]`);
    }
    if (hasAudio) {
      const outAt = round(Math.max(0, dur - fade));
      parts.push(
        `[0:a]atrim=start=${seg.start}:end=${seg.end},asetpts=PTS-STARTPTS,` +
          `afade=t=in:d=${fade},afade=t=out:st=${outAt}:d=${fade}[a${i}]`,
      );
      concatInputs.push(`[a${i}]`);
    }
  });

  const outs = [];
  if (hasVideo) outs.push('[vcat]');
  if (hasAudio) outs.push('[acat]');
  parts.push(
    `${concatInputs.join('')}concat=n=${segments.length}:v=${hasVideo ? 1 : 0}:a=${hasAudio ? 1 : 0}${outs.join('')}`,
  );

  if (hasVideo) {
    if (vertical) {
      parts.push('[vcat]crop=trunc(ih*9/16/2)*2:ih,scale=1080:1920,setsar=1[vout]');
    } else {
      parts.push('[vcat]null[vout]');
    }
  }
  if (hasAudio) parts.push('[acat]anull[aout]');
  return parts.join(';\n');
}

export function renderEdl(input, edl, output, flags = {}) {
  const segments = edl.segments;
  if (!Array.isArray(segments) || segments.length === 0) {
    fail('the edit list has no segments to render (everything was cut?)');
  }
  const info = probe(input);
  const draft = Boolean(flags.draft);
  const crf = num(flags, 'crf', draft ? 28 : 20);
  const vertical = Boolean(flags.vertical);

  mkdirSync(dirname(output), { recursive: true });
  const work = mkdtempSync(join(tmpdir(), 'aek-'));
  const scriptPath = join(work, 'filter.txt');
  try {
    writeFileSync(
      scriptPath,
      buildFilterGraph(segments, { hasVideo: info.hasVideo, hasAudio: info.hasAudio, vertical }),
    );

    const args = ['-hide_banner', '-y', '-i', input, '-filter_complex_script', scriptPath];
    if (info.hasVideo) {
      args.push(
        '-map', '[vout]',
        '-c:v', 'libx264',
        '-preset', draft ? 'veryfast' : 'medium',
        '-crf', String(crf),
        '-pix_fmt', 'yuv420p',
      );
    }
    if (info.hasAudio) args.push('-map', '[aout]', '-c:a', 'aac', '-b:a', '160k');
    args.push('-movflags', '+faststart', output);

    const r = run('ffmpeg', args);
    if (r.error || r.code !== 0) {
      fail(`ffmpeg render failed: ${r.stderr.trim().split('\n').slice(-5).join(' | ')}`);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }

  const expected = round(segments.reduce((s, x) => s + (x.end - x.start), 0));
  const out = probe(output);
  return {
    output,
    expectedDuration: expected,
    actualDuration: out.duration,
    durationDelta: round(out.duration - expected),
    width: out.width,
    height: out.height,
    fps: out.fps,
    segments: segments.length,
  };
}

export function loadEdl(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    fail(`could not read edit list "${path}": ${e.message}`);
  }
}
