---
name: auto-edit
description: Auto-edit a talking-head or screen-recording video. Detects and cuts silences, builds a reviewable edit list, and renders a draft with FFmpeg. Use when the user wants to tighten, clean up, or auto-edit a video file, cut dead air, or produce a rough cut.
---

# auto-edit

Turn a raw recording into a tightened draft. The CLI does the deterministic work;
you decide parameters, show the cuts, and verify the result.

CLI: `node "${CLAUDE_PLUGIN_ROOT}/scripts/aek.mjs"` (called `aek` below).
If `CLAUDE_PLUGIN_ROOT` is not set, use `scripts/aek.mjs` from this repo.

## Workflow

1. **Check the environment.** Run `aek doctor`. Node 22+, ffmpeg and ffprobe are required.
   If they are missing, tell the user what to install and stop.
2. **Inspect the source.** Run `aek probe <file>`. Note duration, resolution, whether it has audio.
   No audio stream means silence cutting cannot work; say so.
3. **Detect silences.** Run `aek silences <file> --out renders/<name>.silences.json`.
   Defaults: noise floor -30 dB, minimum silence 0.5 s, 0.08 s padding kept around speech.
   Tune when the result looks wrong:
   - Noisy room or fan hum, almost nothing detected: raise `--noise` toward -25.
   - Quiet speaker, speech being cut: lower `--noise` toward -40.
   - Want a tighter pace: lower `--min` to 0.3. Want a calmer pace: raise it to 0.8.
4. **Show the plan before rendering.** Report `stats` (segments, seconds removed, percent removed)
   and the longest silences. If the user asked for a reviewed edit, wait for approval.
   Extra cuts (a flubbed take, an aside) go in with `aek plan <silences.json> --drop "12.5-14,30-31" --out renders/<name>.edl.json`.
   Without extra cuts you can skip `plan` and use `run`.
5. **Render a draft.** `aek render <file> <edl.json> renders/<name>.edited.mp4 --draft`,
   or `aek run <file> --draft` for steps 3 to 5 in one go. Drop `--draft` for the final quality pass.
6. **Verify.** The render result includes `expectedDuration`, `actualDuration` and `durationDelta`.
   A delta beyond about 0.2 s means something is wrong; investigate before reporting success.
7. **Report briefly.** Original length, new length, percent removed, output path. Do not recap the steps.

## Mistakes and retakes

Silence detection does not find flubbed words or repeated takes. For those, get a word-level
transcript (the user's existing one, Whisper, or Herk Edit Kit's helper), find the bad ranges
yourself, show them to the user, then add them with `--drop`.

## Optional: Herk Edit Kit

`aek setup` downloads Herk Edit Kit into `vendor/herk-edit-kit`. If it is present and the user wants
captions, B-roll, storytelling or motion graphics, open that folder and use its skills
(`edit-video`, `cut-mistakes`, `video-storytelling`, `style-library`, `motion-showreel`).
Tell the user before running anything from `vendor/`; it is downloaded code. Do not copy its AIS
brand assets or showcase videos into the user's projects.

## Rules

- Never modify or overwrite the source file. Outputs go in `renders/` next to it.
- Do not claim success without the duration check in step 6.
