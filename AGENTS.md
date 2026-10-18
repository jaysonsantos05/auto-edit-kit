# auto-edit-kit: agent instructions

Auto-editing toolkit. A zero-dependency Node CLI (`scripts/aek.mjs`) wraps FFmpeg;
skills in `skills/` describe the editing workflow and call the CLI.

## CLI

Run from the repo root, or from a plugin as `node "${CLAUDE_PLUGIN_ROOT}/scripts/aek.mjs"`.

| Command | Purpose |
|---|---|
| `doctor` | Check Node 22+, FFmpeg, ffprobe, git, Chrome, vendored Herk kit |
| `setup [--dir D] [--install]` | Clone Herk Edit Kit into `vendor/` (or update it) |
| `probe <file>` | JSON: duration, resolution, fps, streams |
| `silences <file> [--noise -30] [--min 0.5] [--pad 0.08] [--min-keep 0.15] [--out f.json]` | Detect silences, output keep segments |
| `plan <silences.json> [--drop "12.5-14,30-31"] [--out edl.json]` | Build an edit list, optionally removing extra ranges |
| `render <input> <edl.json> <out.mp4> [--vertical] [--draft] [--crf 20]` | Render the edit list |
| `run <input> [--out f.mp4] [--vertical] [--draft] [...silences flags]` | silences + plan + render in one go |

## Rules

- Never overwrite the user's source footage. Outputs go next to it or in `renders/`.
- Show the user the proposed cuts (`stats` and segment count) before the final render
  when they asked for a reviewed edit.
- After rendering, verify with `probe` that the output duration matches the EDL total.
- Do not run scripts from `vendor/` without telling the user; it is downloaded code.
- Do not put API keys in chat, files in git, or URLs. Use `.env`.
