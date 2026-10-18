#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { parseArgs, probe, fail } from './lib.mjs';
import { detectSilences } from './silences.mjs';
import { buildPlan } from './plan.mjs';
import { renderEdl, loadEdl } from './render.mjs';
import { doctor } from './doctor.mjs';
import { setup } from './setup.mjs';

const HELP = `aek: auto-edit-kit CLI

  aek doctor
  aek setup [--dir D] [--install]
  aek probe <file>
  aek silences <file> [--noise -30] [--min 0.5] [--pad 0.08] [--min-keep 0.15] [--out f.json]
  aek plan <silences.json> [--drop "12.5-14,30-31"] [--out edl.json]
  aek render <input> <edl.json> <out.mp4> [--vertical] [--draft] [--crf N]
  aek run <input> [--out f.mp4] [--vertical] [--draft] [--drop ...] [silences flags]
`;

function emit(obj, outPath) {
  const text = JSON.stringify(obj, null, 2);
  if (outPath && outPath !== true) {
    mkdirSync(dirname(resolve(outPath)), { recursive: true });
    writeFileSync(outPath, text + '\n');
    console.error(`aek: wrote ${outPath}`);
  }
  console.log(text);
}

const [cmd, ...rest] = process.argv.slice(2);
const { positional, flags } = parseArgs(rest);

switch (cmd) {
  case 'doctor': {
    const result = doctor();
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ready ? 0 : 1);
    break;
  }
  case 'setup':
    emit(setup(flags));
    break;
  case 'probe':
    if (!positional[0]) fail('usage: aek probe <file>');
    emit(probe(positional[0]));
    break;
  case 'silences':
    if (!positional[0]) fail('usage: aek silences <file> [flags]');
    emit(detectSilences(positional[0], flags), flags.out);
    break;
  case 'plan':
    if (!positional[0]) fail('usage: aek plan <silences.json> [--drop ...] [--out edl.json]');
    emit(buildPlan(positional[0], flags), flags.out);
    break;
  case 'render': {
    const [input, edlPath, output] = positional;
    if (!input || !edlPath || !output) fail('usage: aek render <input> <edl.json> <out.mp4> [flags]');
    emit(renderEdl(input, loadEdl(edlPath), output, flags));
    break;
  }
  case 'run': {
    const input = positional[0];
    if (!input) fail('usage: aek run <input> [--out f.mp4] [flags]');
    const base = basename(input, extname(input));
    const dir = join(dirname(resolve(input)), 'renders');
    const output = flags.out && flags.out !== true ? flags.out : join(dir, `${base}.edited.mp4`);
    const silencesPath = join(dir, `${base}.silences.json`);
    const edlPath = join(dir, `${base}.edl.json`);

    const silences = detectSilences(input, flags);
    mkdirSync(dir, { recursive: true });
    writeFileSync(silencesPath, JSON.stringify(silences, null, 2) + '\n');

    const plan = buildPlan(silencesPath, flags);
    writeFileSync(edlPath, JSON.stringify(plan, null, 2) + '\n');

    const render = renderEdl(input, plan, output, flags);
    emit({ silencesPath, edlPath, plan: plan.stats, render });
    break;
  }
  default:
    console.log(HELP);
    process.exit(cmd && cmd !== 'help' && cmd !== '--help' ? 1 : 0);
}
