import { readFileSync } from 'node:fs';
import { fail, round } from './lib.mjs';
import { summarize } from './silences.mjs';

/** Parse "12.5-14,30-31" into [{start, end}]. */
export function parseRanges(text) {
  if (!text || text === true) return [];
  return String(text)
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const m = r.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
      if (!m) fail(`bad range "${r}". Use start-end in seconds, e.g. 12.5-14`);
      const start = Number(m[1]);
      const end = Number(m[2]);
      if (end <= start) fail(`range "${r}" must end after it starts`);
      return { start, end };
    });
}

/** Remove the `drops` ranges from the `keeps` segments. */
export function subtract(keeps, drops) {
  let result = keeps.map((k) => ({ ...k }));
  for (const d of drops) {
    const next = [];
    for (const k of result) {
      if (d.end <= k.start || d.start >= k.end) {
        next.push(k);
        continue;
      }
      if (d.start > k.start) next.push({ start: k.start, end: d.start });
      if (d.end < k.end) next.push({ start: d.end, end: k.end });
    }
    result = next;
  }
  return result.map((k) => ({ start: round(k.start), end: round(k.end) }));
}

export function buildPlan(silencesFile, flags = {}) {
  let data;
  try {
    data = JSON.parse(readFileSync(silencesFile, 'utf8'));
  } catch (e) {
    fail(`could not read "${silencesFile}": ${e.message}`);
  }
  if (!Array.isArray(data.keeps)) fail(`"${silencesFile}" is not an aek silences file (no "keeps" array)`);

  const drops = parseRanges(flags.drop);
  const segments = subtract(data.keeps, drops);
  return {
    input: data.input,
    duration: data.duration,
    drops,
    segments,
    stats: summarize(segments, data.duration),
  };
}
