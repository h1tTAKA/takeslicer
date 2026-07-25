# takeslicer

A desktop app that automates the tedious prep work before vocal comping.

Recording sessions leave you with a messy pile of vocal takes — multiple tracks, doubles, harmonies, and takes scattered across the timeline. Before you can comp, you have to cut each section, name it, and organize it by hand. **takeslicer does that cutting, naming, and foldering automatically**, so you can jump straight to comping in your DAW (FL Studio, etc.).

## How it works

1. **Define sections** — enter each song section (Intro, Verse A, Pre-Chorus, Chorus...) with its start/end time. You know your own song's timing, so no reference track needed.
2. **Upload takes** — drop in all the recorded WAV files for the song.
3. **Verify** — see each take's waveform with your section boundaries overlaid, to confirm the sections line up and which tracks have audio where.
4. **Render** — for every section × every take, takeslicer slices out the tracks that actually contain audio and saves them into per-section folders.

### Output

```
Chorus/
  Chorus01vocal_main.wav
  Chorus02vocal_harmony.wav
Verse_A/
  VerseA01vocal_main.wav
```

- Naming: `{section}{NN}{originalFileName}.wav` — the original file name keeps doubles/harmonies distinct.
- **Rendered from 0:00** — each slice keeps the song's start point, so dragging it back into your DAW snaps to the correct timeline position automatically. The clip runs from 0:00 up to where the audio ends plus a short tail.
- Silent tracks in a section are skipped (RMS threshold, with a tunable knob for breaths / reverb tails).

## Tech

Electron + electron-vite + React + TypeScript. Design notes: `docs/takeslicer작업/masterplan.md`.

## Development

```bash
npm install      # first time
npm run dev      # launch the app in dev mode
```

## Build

```bash
npm run build:mac     # macOS
npm run build:win     # Windows
npm run build:linux   # Linux
```
