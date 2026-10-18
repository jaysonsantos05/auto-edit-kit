import { run, probe, fail, num, round } from './lib.mjs';

/** Parse ffmpeg silencedetect log output into [{start, end}]. */
export function parseSilenceLog(log, duration) {
  const out = [];
  for (const line of log.split('\n')) {
    const s = line.match(/silence_start:\s*(-?[\d.]+)/);
    if (s) {
      out.push({ start: Math.max(0, Number(s[1])), end: null });
      continue;
    }
    const e = line.match(/silence_end:\s*(-?[\d.]+)/);
    if (e && out.length && out[out.length - 1].end === null) {
      out[out.length - 1].end = Math.min(duration, Number(e[1]));
    }
  }
  // A silence that runs to the end of the file has no silence_end line.
  for (const s of out) if (s.end === null) s.end = duration;
  return out
    .filter((s) => s.end > s.start)
    .map((s) => ({ start: round(s.start), end: round(s.end) }));
}

/**
 * Turn silences into the segments to keep. Each silence is shrunk by `pad`
 * seconds on both sides so cuts do not clip the start or end of words.
 */
export function computeKeeps(silences, duration, { pad = 0.08, minKeep = 0.15 } = {}) {
  const raw = [];
  let cursor = 0;
  for (const s of silences) {
    const keepEnd = Math.min(duration, s.start + pad);
    if (keepEnd > cursor) raw.push([cursor, keepEnd]);
    cursor = Math.max(cursor, s.end - pad);
  }
  if (cursor < duration) raw.push([cursor, duration]);

  // Merge overlapping or touching segments.
  raw.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const seg of raw) {
    const last = merged[merged.length - 1];
    if (last && seg[0] <= last[1]) last[1] = Math.max(last[1], seg[1]);
    else merged.push([...seg]);
  }
  return merged
    .filter(([s, e]) => e - s >= minKeep)
    .map(([s, e]) => ({ start: round(s), end: round(e) }));
}

export function summarize(keeps, duration) {
  const kept = keeps.reduce((sum, k) => sum + (k.end - k.start), 0);
  return {
    segments: keeps.length,
    keptSeconds: round(kept),
    removedSeconds: round(duration - kept),
    percentRemoved: duration ? round(((duration - kept) / duration) * 100, 1) : 0,
  };
}

export function detectSilences(file, flags = {}) {
  const noise = num(flags, 'noise', -30);
  const minSilence = num(flags, 'min', 0.5);
  const pad = num(flags, 'pad', 0.08);
  const minKeep = num(flags, 'min-keep', 0.15);

  const info = probe(file);
  if (!info.hasAudio) fail(`"${file}" has no audio stream, so silence detection is not possible.`);

  const r = run('ffmpeg', [
    '-hide_banner', '-nostats',
    '-i', file,
    '-vn',
    '-af', `silencedetect=noise=${noise}dB:d=${minSilence}`,
    '-f', 'null', '-',
  ]);
  if (r.error || r.code !== 0) fail(`ffmpeg silencedetect failed: ${r.stderr.trim().split('\n').slice(-3).join(' | ')}`);

  const silences = parseSilenceLog(r.stderr, info.duration);
  const keeps = computeKeeps(silences, info.duration, { pad, minKeep });
  return {
    input: file,
    duration: info.duration,
    params: { noise, minSilence, pad, minKeep },
    silences,
    keeps,
    stats: summarize(keeps, info.duration),
  };
}
