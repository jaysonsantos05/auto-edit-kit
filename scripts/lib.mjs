import { spawnSync } from 'node:child_process';

export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    ...opts,
  });
  return {
    code: r.status ?? 1,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    error: r.error,
  };
}

export function fail(message) {
  console.error(`aek: ${message}`);
  process.exit(1);
}

export function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const eq = key.indexOf('=');
      if (eq !== -1) {
        flags[key.slice(0, eq)] = key.slice(eq + 1);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        flags[key] = argv[++i];
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

export function num(flags, name, fallback) {
  if (flags[name] === undefined || flags[name] === true) return fallback;
  const v = Number(flags[name]);
  if (!Number.isFinite(v)) fail(`--${name} must be a number, got "${flags[name]}"`);
  return v;
}

export function round(n, places = 3) {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

export function probe(file) {
  const r = run('ffprobe', [
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    file,
  ]);
  if (r.error || r.code !== 0) {
    fail(`ffprobe failed for "${file}": ${(r.stderr || r.error?.message || '').trim()}`);
  }
  const data = JSON.parse(r.stdout);
  const video = data.streams.find((s) => s.codec_type === 'video');
  const audio = data.streams.find((s) => s.codec_type === 'audio');
  let fps = null;
  if (video?.r_frame_rate) {
    const [n, d] = video.r_frame_rate.split('/').map(Number);
    if (d) fps = round(n / d, 3);
  }
  return {
    file,
    duration: round(Number(data.format.duration)),
    hasVideo: Boolean(video),
    hasAudio: Boolean(audio),
    width: video?.width ?? null,
    height: video?.height ?? null,
    fps,
    videoCodec: video?.codec_name ?? null,
    audioCodec: audio?.codec_name ?? null,
  };
}
