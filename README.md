# auto-edit-kit

An auto-editing toolkit for [Claude Code](https://claude.com/claude-code). A small FFmpeg-based CLI does
the deterministic work (find silences, build an edit list, render a draft), and Claude Code skills drive
it: you give Claude a recording, it proposes the cuts, you approve, it renders and verifies.

It is a plugin repo, not an MCP server. Optionally it can pull in
[Herk Edit Kit](https://github.com/nateherkai/herk-edit-kit) for captions, B-roll and motion graphics.

## What you get

| Piece | What it does |
|---|---|
| `auto-edit` skill | Cut silences from a recording, show the cuts, render a verified draft |
| `auto-short` skill | Same, plus a centered 9:16 crop (1080x1920) for reels and Shorts |
| `/auto-edit-kit:auto-edit` command | Shortcut: `/auto-edit-kit:auto-edit path/to/video.mp4 make it a vertical short` |
| `aek` CLI | `doctor`, `setup`, `probe`, `silences`, `plan`, `render`, `run` |

Zero npm dependencies. Needs Node.js 22+, FFmpeg and ffprobe. Chrome is only needed if you later use
Herk Edit Kit's HyperFrames motion graphics.

## Install

As a Claude Code plugin (replace `YOUR-USER` with your GitHub name after you push the repo):

```
/plugin marketplace add YOUR-USER/auto-edit-kit
/plugin install auto-edit-kit@auto-edit-kit
```

Or install it from a local folder, no GitHub needed:

```
claude plugin marketplace add ./auto-edit-kit
claude plugin install auto-edit-kit@auto-edit-kit
```

Or load it for a single session only:

```
claude --plugin-dir ./auto-edit-kit
```

Plugin commands are namespaced, so the command is `/auto-edit-kit:auto-edit`. Edits to the folder apply
at the next session start or after `/reload-plugins`.

Then check your machine:

```
node scripts/aek.mjs doctor
```

## Use it

In Claude Code:

```
/auto-edit-kit:auto-edit ~/Videos/recording.mp4
/auto-edit-kit:auto-edit ~/Videos/recording.mp4 make it a vertical short, tight pacing
```

Or run the CLI directly:

```
# one shot: detect, plan, render a draft into ./renders next to the source
node scripts/aek.mjs run recording.mp4 --draft

# step by step
node scripts/aek.mjs silences recording.mp4 --out renders/rec.silences.json
node scripts/aek.mjs plan renders/rec.silences.json --drop "12.5-14" --out renders/rec.edl.json
node scripts/aek.mjs render recording.mp4 renders/rec.edl.json renders/rec.edited.mp4
```

Tuning silence detection: `--noise` (dB floor, default -30; raise it for noisy rooms, lower it for quiet
speakers), `--min` (shortest silence to cut, default 0.5 s), `--pad` (speech padding, default 0.08 s).

The source file is never modified. Outputs go in `renders/`, and every render reports expected versus actual
duration so a bad cut is caught.

## Optional: Herk Edit Kit

```
node scripts/aek.mjs setup            # clones into vendor/herk-edit-kit (git-ignored)
node scripts/aek.mjs setup --install  # also runs npm ci there
```

That adds transcript-driven mistake cutting, captions, B-roll and motion-graphics cards through Herk's own
skills. It is downloaded code, so the skills tell Claude to say so before running anything from `vendor/`.
Read `NOTICE.md` for the license terms; the AIS brand assets and showcase videos in that repo are not
licensed for reuse.

## Tests

```
npm test
```

Generates a synthetic clip with known silences, runs the whole pipeline, and checks segment counts, output
duration and the 1080x1920 vertical size.

## Roadmap

- Transcript-aware cutting (flubbed takes, filler words) with a bundled Whisper step
- Smarter vertical reframing that follows the speaker
- Optional MCP server wrapping the same CLI, for use from Claude Desktop, Codex or Cursor
- Caption burn-in

## License

MIT. See `LICENSE` and `NOTICE.md`.
