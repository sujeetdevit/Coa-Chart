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
  application/ filters, selection, freeze, refresh, print options, configuration use
  engine/      chart mathematics: scales, viewport, geometry, hit testing
  interactions/ gestures → viewport changes
  rendering/
    types/     renderer-independent render model and renderer interface
    build/     engine state → render model
    konva/     KonvaRenderer, the only renderer (one painted shape per group of primitives)
```

## Chart controls

| Input                                     | Effect                          |
| ----------------------------------------- | ------------------------------- |
| Wheel over the plot or time labels        | Zoom time about the pointer     |
| Wheel over station names, or Ctrl+wheel   | Zoom stations about the pointer |
| Shift+wheel, or horizontal trackpad swipe | Pan time                        |
| Drag                                      | Pan                             |
| Double-click, or **Now**                  | Back to the initial window      |

The **Caution**, **Lines** and **Unusual** checkboxes at the right end of the toolbar show or hide those
columns on the right. The chart widens to use the space of a hidden column. All three come back
on **Refresh** or a page reload, and the printed chart always includes them.

Blocks are hatched by the line they are imposed on: lines rising to the right for UP, falling to
the right for DN, and crossed for both lines. The legend (**L**) repeats this.

With **Zoom** ticked, drag a rectangle to zoom into it. With **MSM** ticked, click a block section a
train has run through. Right-click the chart for **Write Pad** (EPEN), **Message Show** and, over a
train, a single-train forecast. In a manual forecast (tick **Manual**, then **MF**), drag a forecast
point sideways to change its time.

## Refresh, printing and errors

**Refresh.** The header shows when the data was last checked. **Refresh** reloads it now; **Auto
refresh** reloads it every 3 minutes (off by default, as in the manual). Automatic refreshes wait
while the browser tab is hidden, and **Freeze** holds new data back until it is switched off. Data
that has not changed is not redrawn.

**Print.** **Print** opens the Print Chart form: shift start, shift hours, Speed, Gain/Loss, Crew,
EPEN messages and the controller's name, with a preview. **Print** sends an A4 landscape page to the
browser's print dialog; **Save PNG** saves the same picture.

**Errors.**

- One dataset fails to load (crew, loco, remarks, blocks, cautions or movement): the chart is drawn
  without it and a red notice names the dataset and the reason.
- `BoardDetails` or `StationLine` fails: there is no station axis to draw, so the load fails with
  a **Try again** button.
- A refresh fails: the data already on screen stays, with a "Refresh failed" badge.
- A drawing error is caught and offers **Try again** instead of a blank page.

### Connecting an API

Data reaches the chart through one interface, `ChartDataSource` in
`src/current-chart/adapters/types.ts`, and is chosen in one place, `src/app/App.tsx`.

- If the API serves one JSON document per dataset in the same row shapes as the files in
  `src/data/`, use `JsonFileDataSource` with the API's URLs. A URL can be a function of the query
  (board and time range).
- Otherwise implement `ChartDataSource.load()` and return the rows per dataset. Validation, the
  adapters and the chart need no change.

Set `VITE_API_BASE_URL` (for example in `.env.local`: `VITE_API_BASE_URL=http://10.77.32.98/chartdemo/api/chart`) to load from the COA chart API; unset, the JSON files in `src/data/` are used. Division, board, user and the time window (hours before and after now) are in `src/current-chart/configuration/apiConfig.ts`; the endpoints and their parameter names are in `src/current-chart/adapters/json/apiSource.ts`. The API answers XML unless asked for JSON, so the source sends `Accept: application/json`.

### Assumptions in this phase

| Decision                                                                     | Basis                                         |
| ---------------------------------------------------------------------------- | --------------------------------------------- |
| Auto refresh off by default                                                  | Manual: Auto Refresh Enable, default N        |
| 3-minute refresh interval                                                    | Legacy web chart; the manual gives no default |
| Refresh pauses while the tab is hidden                                       | Not in the manual                             |
| `BoardDetails` and `StationLine` are required, other datasets are not        | The chart cannot be drawn without stations    |
| Print form starts with the period and options on screen                      | Not in the manual                             |
| Printed page is A4 landscape                                                 | Not in the manual                             |
| Controller name is typed in                                                  | No source for it was supplied                 |
| Not done: movable labels on the printed chart, load summary, timed auto-save | Need details or data that were not supplied   |

## Sample data

No forecast, MSM (mid-section GPS) or EPEN services were supplied. The app uses stand-ins behind
the `ForecastProvider`, `MsmProvider` and `EpenStore` interfaces, and labels them on screen:

- `src/data/forecast.sample.json`: sample forecasts generated by `scripts/gen_forecast_sample.py`
  from the snapshot's median running times. **Not** the COA forecast algorithm.
- `SampleMsmProvider`: a smooth sample speed profile between reported departure and arrival.
- `InMemoryEpenStore`: e-pen notes kept for the browser session only.

ESLint enforces the boundaries: Konva may only be imported under `rendering/konva`, and `domain`, `engine` and `rendering/types` may not import React, Konva or adapters.

The supplied snapshot lives in `src/data/`. The app fetches it at runtime as separate assets.
