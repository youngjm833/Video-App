# VideoApp — AI Video Editor

Upload raw footage, describe the video you want in plain language, and the app edits your clips into a finished video — entirely in the browser.

```
raw clips  →  "make a fast 30s highlight reel"  →  edit plan  →  rendered video
```

## How it works

1. **Add footage** — drag & drop video files (MP4, WebM, MOV), or click *Load sample footage* to try it with the bundled demo clips.
2. **Describe the edit** — e.g. *"Make a fast-paced 30 second highlight reel titled "Summer 2026" with punchy colors"*. The director understands:
   - **length** — "30 seconds", "2 minutes"
   - **pacing** — "fast", "punchy", "calm", "cinematic"
   - **format** — "vertical", "9:16", "TikTok", "Instagram reel", "square"
   - **style** — "cinematic" (letterbox), "black and white", "punchy/vibrant" (color grade)
   - **speed** — "slow motion", "timelapse"
   - **structure** — "montage" (intercut clips), "shuffle", chronological by default
   - **title** — `titled "…"` renders an opening title card
3. **Review and refine the plan** — the director explains its choices and shows the cut timeline, color-coded by source clip. Every cut is editable before you commit to a render:
   - **Preview** any cut — an inline player loops exactly the trimmed window at the cut's speed
   - **Trim** by dragging the edge handles, or slide the whole window along the clip
   - **Reorder** by dragging rows (or the ↑/↓ buttons), **duplicate**, **delete**, or **add** cuts
   - Change a cut's **source clip** or **playback speed** (0.5×–2×)
4. **Render** — ffmpeg.wasm executes the edit plan client-side and produces a downloadable WebM. Your footage never leaves the browser. Editing the plan after a render clears the stale output so what you download always matches the timeline.

## The AI director

The edit-planning brain is defined by one interface (`EditDirector` in `src/types.ts`):

```ts
interface EditDirector {
  name: string
  createEditPlan(request: EditRequest): Promise<EditPlan>
}
```

Two implementations ship with the app; the active one is shown in the header badge:

- **Claude Director** (`src/director/claude.ts`) — used automatically when an Anthropic API key is set in **Settings** (⚙). It samples frames from each clip at known timestamps, sends them to Claude (`claude-opus-4-8`, adaptive thinking) together with your brief, and receives a schema-validated edit plan via structured outputs. Because Claude *sees* the footage, it trims around the strongest moments instead of cutting blindly. Plans are sanitized before rendering (segments clamped to real clip bounds, speeds to 0.5–2×, unknown clips dropped). Get a key at [console.anthropic.com](https://console.anthropic.com) — the key is stored in your browser's localStorage and sent directly to the Anthropic API, which is fine for personal use; put a small backend in front before sharing the app with others.
- **Heuristic Director** (`src/director/heuristic.ts`) — the offline fallback when no key is set. It parses the prompt with keyword rules and spreads segments evenly across the footage, so the full pipeline works without any account.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (default `http://localhost:5173`).

## Scripts

| Command           | Description                         |
| ----------------- | ----------------------------------- |
| `npm run dev`     | Start the development server        |
| `npm run build`   | Type-check and build for production |
| `npm run preview` | Preview the production build        |
| `npm run lint`    | Lint the codebase with oxlint       |

## Project structure

```
src/
  director/       Edit-planning AI: Claude director + offline heuristic (EditDirector interface)
  render/         ffmpeg.wasm engine: filtergraph builder, title cards, renderer
  components/     UI: UploadZone, ClipList, PromptPanel, PlanView, RenderPanel
  utils/          Clip metadata/thumbnails, formatting helpers
  types.ts        Clip, EditPlan, EditDirector, and friends
public/
  videos/         Bundled sample footage (procedurally generated with ffmpeg)
```

## Notes

- Rendering uses single-threaded ffmpeg.wasm (~32 MB, loaded once on first render). Short clips render in seconds; long footage takes proportionally longer.
- Source audio is carried into the edit when every selected clip has an audio track; otherwise the render falls back to video-only.
- The bundled sample clips are procedurally generated (fractals, cellular automata, gradients), so the repo is fully self-contained and works offline.
