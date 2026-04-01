# Studio.One Model Train — Design Spec
**Date:** 2026-04-01
**Status:** Approved

---

## Overview

A local Next.js web application for reviewing and auto-captioning video training clips using the Google Gemini API. The user opens `localhost:3000` in their browser, sees all clips in a grid or list, configures Gemini settings, then kicks off captioning and watches captions fill in under each clip in real time.

---

## Architecture

**Stack:** Next.js (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui · `@google/genai` JS SDK

**Single process — one `npm run dev` starts everything.** No Python runtime required. Captioning logic is ported to TypeScript using the same `@google/genai` SDK already confirmed available.

```
Browser  ←→  Next.js App Router
                ├── /             (main UI — React client component)
                ├── /api/clips    (GET — scan clips dir, return metadata list)
                ├── /api/video/[filename]  (GET — stream video file from disk)
                └── /api/caption  (POST — SSE stream, runs Gemini captioning)
```

**Clips directory** is configured via the `CLIPS_DIR` environment variable in `.env.local` (e.g. `E:\WS_2026\WS_CUSTOM_MODEL_TRAINING\TRAINING\CHUNKS`). The API key is entered in the UI and stored in `localStorage` — not in env, to avoid accidental commits.

---

## Components

### Header
- App title: `Studio.One Model Train` (indigo accent on "One")
- API key password input (persisted in localStorage)
- `▶ Start Captioning` button (disabled until API key present and clips loaded)

### Settings Panel
Always visible below the header. Two controls:
- **Model selector** — dropdown populated from a hardcoded list of current Gemini Flash/Pro models: `gemini-3-flash-preview`, `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-3.1-flash-lite-preview`
- **Custom instructions** — textarea. Used as the Gemini prompt when non-empty; falls back to the built-in default prompt when empty. Placeholder text shows the default prompt so the user knows what they're overriding.

### Progress Bar
Visible once captioning has started (hidden on first load if no job is running).
- `X of N clips captioned` on the left
- Current clip filename + model name + rough time remaining on the right
- Animated indigo shimmer fill

### Toolbar
- Filter buttons: `All (N)` / `✓ Done (N)` / `⟳ Pending (N)`
- View toggle (right side): grid icon / list icon

### Clip Grid (grid view)
Cards sized at `minmax(340px, 1fr)` — large enough to preview clips. Each card:
- **Thumbnail area** (16:9): `<video>` element pointing at `/api/video/[filename]`. On hover shows a ▶ play icon overlay. Clicking opens the fullscreen modal.
- **Gradient overlay** at bottom of thumbnail: filename + duration/fps/resolution
- **Status badge** (top-right corner): `✓ Done` (green) / `⟳ Captioning` (amber, pulsing) / `Pending` (muted)
- **Caption area** below thumbnail:
  - Pending: three skeleton placeholder lines
  - Captioning: once the full caption arrives via SSE, a client-side typewriter animation reveals it character-by-character with a blinking `▋` cursor
  - Done: full caption text

### Clip List (list view)
Same data, horizontal layout:
- Thumbnail on the left (240px wide, 16:9 aspect, same hover/click behaviour)
- Status badge overlaid top-right of thumbnail
- Right side: filename + metadata row, caption text below

### Fullscreen Modal
Triggered by clicking any clip thumbnail (grid or list). Renders over the page with a dark overlay.
- Large `<video>` element (16:9, full modal width, controls visible)
- Footer: filename, status badge, duration/fps metadata
- Full caption text below
- `✕ Close` button top-right (also closes on Escape / clicking overlay)

---

## Data Flow

### On page load
`/api/clips` scans `CLIPS_DIR` for `*.mp4` files, checks for paired `.txt` sidecar files, and returns:
```ts
{ file: string, duration: number, fps: number, resolution: string, caption: string | null }[]
```
Clips with existing sidecars are pre-populated with their captions (shown as Done).

### Video serving
`/api/video/[filename]` reads the file from `CLIPS_DIR` and streams it with correct `Content-Type: video/mp4` and `Accept-Ranges` support so the `<video>` element can seek.

### Captioning (SSE stream)
`POST /api/caption` accepts `{ apiKey, model, instructions, files[] }` in the body and opens a Server-Sent Events response. For each clip:
1. Upload to Gemini Files API
2. Poll until `ACTIVE`
3. `generate_content` with the prompt
4. Delete the uploaded file
5. Write `.txt` sidecar and append to `captions.jsonl` in `CLIPS_DIR`
6. Emit SSE event: `data: {"type":"progress","file":"clip_001.mp4","caption":"...","index":1,"total":55}`

On completion: `data: {"type":"done","total":55}`
On error per clip: `data: {"type":"error","file":"...","message":"..."}`

The client updates each clip card's caption state as events arrive, animating the text in progressively.

---

## State Management

Client-side state lives in a single React context / Zustand store:
```ts
clips: ClipState[]        // loaded on mount, updated by SSE events
isRunning: boolean        // true while SSE stream is open
view: 'grid' | 'list'
filter: 'all' | 'done' | 'pending'
apiKey: string            // synced from/to localStorage
model: string
instructions: string
modalClip: string | null  // filename of clip shown in fullscreen, or null
```

---

## Error Handling

- If `/api/clips` fails (bad `CLIPS_DIR`): show an error banner with the path and instructions to set `.env.local`
- Per-clip Gemini failures: card shows a red `✗ Failed` badge; continues to next clip; failed clips listed in a summary at the end
- SSE connection dropped mid-job: show a "Connection lost — resume?" prompt; re-POSTing skips already-captioned clips (checks for existing `.txt` sidecars)

---

## File Structure

```
studio-one-model-train/
├── app/
│   ├── page.tsx                  # Main UI shell (client component)
│   ├── layout.tsx                # Dark theme root layout, Inter font
│   └── api/
│       ├── clips/route.ts        # GET — scan clips dir
│       ├── video/[filename]/route.ts  # GET — stream video
│       └── caption/route.ts     # POST — SSE captioning stream
├── components/
│   ├── ClipGrid.tsx
│   ├── ClipList.tsx
│   ├── ClipCard.tsx
│   ├── ClipModal.tsx
│   ├── ProgressBar.tsx
│   ├── SettingsPanel.tsx
│   └── Toolbar.tsx
├── lib/
│   ├── clips.ts                  # Scan dir, read sidecars
│   └── gemini.ts                 # Gemini upload/caption/delete logic
├── .env.local                    # CLIPS_DIR=...  (gitignored)
├── .env.example                  # CLIPS_DIR=E:\path\to\chunks
└── docs/superpowers/specs/       # This file
```

---

## Out of Scope

- User authentication (local tool only)
- Uploading clips via the browser
- Editing captions in the UI
- Exporting / downloading the JSONL from the UI
- Multi-directory support
