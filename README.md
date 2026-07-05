# VideoApp

A video streaming web app built with React, TypeScript, and Vite. Browse a library of videos, filter by category, search by title/channel/description, and watch with a full playback page including related "up next" suggestions.

## Features

- **Video library** — responsive thumbnail grid of the full catalog
- **Search** — live filtering across titles, channels, and descriptions
- **Category filters** — Fractals, Generative, Test Patterns
- **Playback page** — HTML5 video player with metadata, description, and related videos
- **Responsive design** — works on desktop and mobile

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
  components/     UI components (Header, VideoCard, VideoGrid, VideoPlayer, CategoryFilter)
  data/           Video catalog metadata
  utils/          Formatting helpers
  types.ts        Shared types
  App.tsx         App shell, search/filter/playback state
public/
  videos/         Sample videos (procedurally generated, see below)
  thumbs/         Thumbnails extracted from the videos
```

## Sample media

The catalog is fully self-contained: every video is procedurally generated with ffmpeg's `lavfi` sources (Mandelbrot zooms, Conway's Game of Life, Rule 110, plasma, animated gradients, and broadcast test patterns), and thumbnails are extracted from the videos themselves. No external media hosts are required — the app works completely offline.
