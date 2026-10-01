# Current Chart

Rebuild of the Indian Railways COA Current Chart: React + TypeScript + Vite, rendered with Konva.

Discovery, decisions and open questions: [docs/phase-1-discovery.md](docs/phase-1-discovery.md).

## Scripts

| Command                           | Purpose                             |
| --------------------------------- | ----------------------------------- |
| `npm run dev`                     | Dev server on http://localhost:5173 |
| `npm test`                        | Unit tests (Vitest)                 |
| `npm run lint`                    | ESLint (strict, type-checked)       |
| `npm run typecheck`               | `tsc -b`                            |
| `npm run format` / `format:check` | Prettier                            |
| `npm run build`                   | Typecheck and production build      |

## Layers

```
src/current-chart/
  adapters/    raw source payloads → validated rows → domain (JSON files now, HTTP API later)
  domain/      framework-free model types
  application/ filters, selection, freeze, refresh, configuration use
  engine/      chart mathematics: scales, viewport, geometry, hit testing
  interactions/ gestures → viewport changes
  rendering/
    types/     renderer-independent render model and renderer interface
    build/     engine state → render model
    konva/     KonvaRenderer, the only renderer
```

## Chart controls

| Input                                     | Effect                          |
| ----------------------------------------- | ------------------------------- |
| Wheel over the plot or time labels        | Zoom time about the pointer     |
| Wheel over station names, or Ctrl+wheel   | Zoom stations about the pointer |
| Shift+wheel, or horizontal trackpad swipe | Pan time                        |
| Drag                                      | Pan                             |
| Double-click, or **Now**                  | Back to the initial window      |

ESLint enforces the boundaries: Konva may only be imported under `rendering/konva`, and `domain`, `engine` and `rendering/types` may not import React, Konva or adapters.

The supplied snapshot lives in `src/data/`. The app fetches it at runtime as separate assets.
