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
3. **Review the plan** — the director explains its choices and shows the cut timeline, color-coded by source clip.
4. **Render** — ffmpeg.wasm executes the edit plan client-side and produces a downloadable WebM. Your footage never leaves the browser.

## The AI director

The edit-planning brain is defined by one interface (`EditDirector` in `src/types.ts`):

```ts
interface EditDirector {
  name: string
  createEditPlan(request: EditRequest): Promise<EditPlan>
}
```

The current implementation (`src/director/heuristic.ts`) is an **offline heuristic mock**: it parses the prompt with keyword rules, selects segments spread across the footage, and writes up its reasoning. When an Anthropic API key is available, a Claude-backed director — which can additionally *look at* sampled frames to pick the best moments — implements the same interface and drops in without changing the UI or renderer.

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
  director/       Edit-planning AI (heuristic mock behind the EditDirector interface)
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
