---
name: auto-short
description: Turn a horizontal recording into a vertical 9:16 short or reel with silences cut. Use when the user wants a reel, YouTube Short, TikTok, or vertical cut of a video.
---

# auto-short

Produces a tightened 1080x1920 draft from a normal 16:9 recording: silences cut, centered 9:16 crop.
This is the mechanical part only. It does not write hooks, captions or B-roll.

CLI: `node "${CLAUDE_PLUGIN_ROOT}/scripts/aek.mjs"` (called `aek` below).

## Workflow

1. `aek doctor`, then `aek probe <file>`. Note the resolution. A centered crop of a 16:9 frame
   keeps only the middle third, so warn the user if the speaker or screen content is not centered.
2. Run `aek run <file> --vertical --draft --min 0.35`. Shorts work better paced tighter than
   long-form, so use a shorter minimum silence than the `auto-edit` default.
3. Check the result: `actualDuration` against `expectedDuration`, and `width`/`height` should be 1080x1920.
   Shorts platforms favor under 60 seconds; say so if the draft is longer.
4. Offer next steps rather than doing them unasked: a hook and payoff plan, captions, B-roll.
   If `vendor/herk-edit-kit` exists (`aek setup` installs it), its `short-form-edit` skill covers those.
   Tell the user before running anything from `vendor/`.

## Limits

- The crop is fixed to the center. If the speaker is off-center, say so and suggest cropping
  in a different position by hand or re-framing the source.
- Do not overwrite the source. Output goes to `renders/`.
