# Current Chart — Phase 1 Discovery

Status: Phase 1 complete and approved. Phase 2 in progress.
Date: 2026-09-30 (decisions recorded 2026-10-01)

## Decisions (2026-10-01)

| Q                                   | Decision                                                                                                                                                                                                                               |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Train colour                        | Use `COLORCODE` from the data. The manual's train-type table is kept in config only, for when a type code exists.                                                                                                                      |
| Manual vs legacy conflicts (C1–C12) | The manual wins. Where the manual is silent (C8 station spacing), the legacy rule is used.                                                                                                                                             |
| Block timestamps                    | `CC` = permitted start, `DD` = permitted end, `EE` = actual start, `FF` = actual end. `CADCLEARTIME` = clearance time. Burst period is assumed to be the part of the actual block after the permitted end (needs confirming visually). |
| "As-of" time for JSON               | Chosen by implementation: the latest actual arrival/departure in `movement.json` that falls inside the main data window (outlier dates excluded). Can be overridden in config.                                                         |
| Write actions                       | Deferred. No write interfaces in this stage.                                                                                                                                                                                           |
| Missing datasets                    | No samples yet. Those features get typed interfaces and test fixtures only, and are listed in the gap report.                                                                                                                          |

## 0. Sources inspected

| #   | Source                                                              | What it is                                                    | Coverage                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `User_manual_sep_25_5.5.9.pdf` (319 pp, v5.5.9, updated 23-09-2025) | COA desktop user manual                                       | §11 "View Chart" / §11.1 Current Chart (pp. 241–253) read in full as text **and** as rendered page images (the legend tables are pictures). Also read §3.1 Preferences (chart/forecast parameters), §3.3 Add Remarks, §4.4.2 BPC, §5.1.7 crew, §9.7 TSL, §12 Print Chart, movement-grid colour notes (§5.1). |
| 2   | `chart data/*.json` (8 files)                                       | Current data contract                                         | Every field profiled: types, null counts, distinct values, cross-file joins.                                                                                                                                                                                                                                 |
| 3   | `chart data/BKN BD1.png`                                            | Annotated screenshot of the desktop chart                     | Shows which JSON file feeds which chart region.                                                                                                                                                                                                                                                              |
| 4   | `COA_Chart.cshtml` (~14.5k lines)                                   | Legacy **web** "CCM – Current Chart" viewer (jQuery + D3/SVG) | Read: layout/HTML, coordinate functions, station axis, train movement renderer, time axis, caution, unusual, block, remarks, loco, crew, filters/search, speed & G/L, zoom, refresh, data loading chain. Skimmed: stable/siding/unattached-loco/"possible attach" renderers, caution-on-chart band, export.  |

Important framing: **the manual describes the COA desktop chart; the `.cshtml` is a separate, read-only web viewer.** They overlap only partly. The legacy page implements none of: forecast (BF/MF/FF/CMI/Reset/WFS/Halt), MSM, Freeze, EPEN, TSL, current-hour shading, legends (L/S), GPS-Loco highlight checkbox, crew-on-label, train selection/movement-through-chart. It adds things the manual doesn't mention (Current/Previous/24 Hrs modes, search, "Caution Orders on Chart" speed bands, unattached GPS loco report, stable/siding train views, line-thickness slider, background colours).

Classification tags used below:

- **M** — confirmed from manual
- **D** — confirmed from supplied data
- **L** — confirmed from legacy implementation
- **?** — needs clarification
- **✗** — not currently supported by supplied sources (no data and/or no specification)

---

## 1. Headline findings

1. **No forecast data exists in the supplied JSON.** Every movement row has `ISARVLACTUAL = 'A'` and `ISDEPTACTUAL = 'A'` (3,390/3,390). The manual's Full Forecast algorithm (§11.1.2) needs NRT, block/line occupancy, group priority, PTT, running characteristics, manual halts, etc. — none supplied. Forecast rendering can be built against a contract; forecast _generation_ cannot be built without inventing rules.
2. **No train-type field exists in the data.** The manual's 26-row train-type colour table cannot be driven from the data. Movement rows carry only `PGFLAG` (P/G/O) and a per-row `COLORCODE` colour name (`Red`, `Chocolate`, `DeepPink`, `Green`, `CADETBLUE`, `Brown`, `Black`, `Magenta`, `Olive`) — several of which don't appear in the manual table. The manual's preference "Train Colour Base = BS | TT" suggests colour is server-decided; legacy uses `COLORCODE` verbatim.
3. **Seven overlay datasets are missing**: unusual occurrences, TSL, GPS loco movement, MSM mid-section samples, EPEN messages, general (non-train) chart remarks, forecast. Plus: board metadata (name/ID), "current time" of the snapshot, max-permissible-speed, BPC validity, fourth-line and flyover flags, line nomination status.
4. **Block timestamps are ambiguous.** `block.json` has `CC`, `DD`, `EE`, `FF`, `CADCLEARTIME`, `CADPRMTEXTNDENDTIME`, `CACEXTNBRSTFLAG`. The manual describes AST (dark red line), AET (cyan line), burst period (red part) and department colours; the legacy ignores all of that and draws a green hatched rectangle from `EE` to `CADCLEARTIME`. Mapping of CC/DD/EE/FF to demanded/permitted/actual needs confirmation.
5. **Board distance data has errors**: `RUG.MANDISTFROMREFSTTN = 1000.0`, `SNP = 88.98` (non-monotonic between 51.55 and 32.79). Legacy spacing does not use this field (it uses `MANDSPLDIST`), so the chart is unaffected, but the right-axis km labels would be wrong.
6. **Crew join is thin**: only 3 of 19 crew train IDs appear in `movement.json`. `COD` is minutes on duty (values up to 12,904 — stale records). Enough to test the mechanism, not to visually validate.
7. **The snapshot's "now" is implicit**: movements end at 21-09-2026 07:54:43; crew sign-ons go to 09:22. The chart needs an explicit reference time (current-time line, shaded past, Current-mode window). Proposal: a configurable "as-of" time for the JSON source, defaulting to the latest reported event.

---

## 2. Requirements inventory

### A. Current Chart layout

| Requirement                                                             | Tag              | Notes                                                                                                    |
| ----------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------- |
| Time on X, stations on Y                                                | M L              | §11                                                                                                      |
| Stations shown on **both left and right** ends                          | M L              | Legacy: left label x=4, right label at width+4.                                                          |
| Shift-wise display                                                      | M                | Legacy: Current (last ~6h ending next hour), Previous (date + from/to hour, 1–8h), 24 Hrs.               |
| Chart View Hours: default 3, range 4–8 (sic)                            | M ?              | Manual says "default 3 … between 4 to 8" — self-contradictory.                                           |
| Chart Plot Hours: completed movements shown for 2–12h (default 2)       | M                | Not in legacy.                                                                                           |
| Right-side panels: caution column, unusual column, line-occupancy panel | M (screenshot) L | Legacy toggles Caution **or** Unusual side panel (radio). Screenshot shows both plus station-line boxes. |
| Header: division, board, date, last update                              | L                | Legacy header; "Last Refresh" footer in manual screenshots.                                              |
| Background colour options                                               | L only           | Three preset colours. Not in manual.                                                                     |

### B. Station layout

| Requirement                                            | Tag                    | Notes                                                                                                                                                                                          |
| ------------------------------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Geographical order, grouped by section                 | M D                    | `BoardDetails` rows are pre-ordered: section display seq (`MANDSPLSQNC`) then station seq (`MANSTTNSQNC`).                                                                                     |
| Section entry/exit stations blue, others black         | M L                    | Legacy rule: first, last, and stations adjacent to a section change → "S" class (blue, bold, larger font).                                                                                     |
| Sidings in **red** under controlling station           | M                      | Legacy draws sidings `deeppink`. **Conflict** (see §3). Siding = `MACCLASSFLAG 'S'` (only `ICB` in data). "Under respective controlled station" — the parent relationship isn't in the data. ? |
| Station spacing                                        | L ?                    | Legacy: cumulative `MANDSPLDIST`, clamped to [4, 15]; class `X` fixed at 2. Manual: "Inter Section Distance Factor" (default 1.5) between sections — not applied by legacy.                    |
| Stray Line (connect repeated stations vertically)      | M ✗                    | Preference only; no repeated stations in board data.                                                                                                                                           |
| Station hover: highlight line + line-occupancy tooltip | L                      | Right-axis hover.                                                                                                                                                                              |
| Station tooltip = distance to previous station         | M (Master Chart §11.2) | Only stated for Master Chart.                                                                                                                                                                  |
| Right-axis km (`MANDISTFROMREFSTTN`)                   | D (screenshot)         | Data errors noted above.                                                                                                                                                                       |
| Click station → station diagram                        | M ✗                    | §11.2.1; no diagram data/API.                                                                                                                                                                  |

### C. Section layout

| Requirement                               | Tag | Notes                                                                           |
| ----------------------------------------- | --- | ------------------------------------------------------------------------------- |
| All sections of the board shown           | M D | Two sections in data: 20 (29 stations, UMB→SZM) and 32 (KURN, BHUL, ICB).       |
| Inter-section gap factor                  | M ? | Default 1.5 — unit unclear (× what?).                                           |
| Train crossing sections at shared station | L   | Legacy remaps Y when consecutive rows share `SEQNO` with different `SUBSCTNID`. |

### D. Time axis

| Requirement                                  | Tag | Notes                                                                                         |
| -------------------------------------------- | --- | --------------------------------------------------------------------------------------------- |
| Hours red, minutes black, 10-minute interval | M L | Legacy: hour lines 0.6px, minute lines 0.25px, labels top and bottom.                         |
| Past up to current hour shaded               | M   | Not in legacy. Screenshots show shaded band.                                                  |
| Minute precision                             | L   | Legacy truncates seconds. Data has seconds (e.g. `16:13:30`). New engine should keep seconds. |
| Zoom levels                                  | L   | Legacy: CSS page zoom slider (4 steps).                                                       |

### E. Train rendering

| Requirement                                                                 | Tag   | Notes                                                                                                                                        |
| --------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Polyline through arrival/departure points per train                         | M L D | Rows ordered by train then `SEQNO` (verified).                                                                                               |
| Arrival/departure tick marks (1×8px) with tooltip Arrival/Departure/Through | L     | "Through" when arr = dep.                                                                                                                    |
| Handover/takeover arrows at chart entry/exit                                | L D   | `PREVSTTNBRDID ≠ NXTSTTNBRDID` → in-arrow at first point; out-arrow at last point when next board ≠ this board and not destination.          |
| Parallel offset for trains stopped >~2 min at same station                  | L     | Legacy `repeatNum × 0.5` km shift by direction.                                                                                              |
| Label de-clutter (stack ±12px)                                              | L     | Legacy.                                                                                                                                      |
| Draggable labels                                                            | L     | Legacy drags start/end labels. Manual: "Rearrange Float Labels" preference (right-click → rearrange).                                        |
| Invalid-BPC goods train → thicker line                                      | M ✗   | No BPC data.                                                                                                                                 |
| Fourth-line running → dashed train-colour line                              | M ✗   | No fourth-line flag (grid colour CADETBLUE is used for fourth line in the movement grid — possibly `COLORCODE=CADETBLUE`? ?).                |
| Flyover block section → arrows on line                                      | M ✗   | No flyover flag.                                                                                                                             |
| Wrong-line (REVS) movement                                                  | M L   | Legacy: white dashed overlay when `LINETYPE='REVS'`. Manual legend shows "W/L" marker for LE in abnormal section. Data has only `NRML`/null. |
| Long haul → Sienna                                                          | M ✗   | No long-haul flag.                                                                                                                           |

### F. Actual movement

| Requirement                                      | Tag   | Notes                                                                                    |
| ------------------------------------------------ | ----- | ---------------------------------------------------------------------------------------- |
| Solid line in train colour                       | M L D |                                                                                          |
| Arrival = `DPRTARVLTIME`, departure = `DPRTTIME` | D L   | Origin: arrival null (74 rows). Arrived-not-departed or terminated: departure null (57). |
| Train Colour Base BS/TT                          | M ?   | Which one does `COLORCODE` represent?                                                    |

### G. Forecast movement

| Requirement                           | Tag | Notes                                                                                                     |
| ------------------------------------- | --- | --------------------------------------------------------------------------------------------------------- |
| Dashed line, black or train colour    | M   | "Is Coloured Forecast" (default N) + "Default Forecast Colour" (Black).                                   |
| Forecast opacity (0–1, default 1.0)   | M   |                                                                                                           |
| Forecast Hour (default 2, ≤4)         | M   |                                                                                                           |
| Forecast Past Time (120 min)          | M   | Only trains reported within this window get forecast.                                                     |
| Same style for system and manual plot | M   |                                                                                                           |
| Forecast data                         | ✗   | Not supplied. `ISARVLACTUAL/ISDEPTACTUAL` likely distinguish actual vs forecast rows in the real API (?). |

### H. Train labels

| Requirement                                                                                                 | Tag | Notes                                                                                                |
| ----------------------------------------------------------------------------------------------------------- | --- | ---------------------------------------------------------------------------------------------------- |
| Start and end ("floating") label                                                                            | L M | Legacy: train no. (or name if no number), wrapped 8/10 chars per line, bordered box in train colour. |
| Label tooltip: train, locos, crew; end label adds "Status at sttn: RT / n mins late/early" (passenger only) | L   | Start tooltip lists all locos; end tooltip lists attached (`A`) locos only.                          |
| Crew details on label when Crew checked                                                                     | M   | "Chart View Crew Details" (default Y).                                                               |
| Load summary on label                                                                                       | M ✗ | "Chart View Load Summary" (default Y) — no consist data.                                             |
| Show Last Train Label (default False)                                                                       | M   |                                                                                                      |
| Train Labels Font Size (default 10)                                                                         | M   |                                                                                                      |
| Floating label blinks if crew > 7h                                                                          | M   | See N.                                                                                               |

### I. Train types and colours

| Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Tag   | Notes                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------- |
| 26-row colour table (Goods green, LE black, Shatabdi/Rajdhani pink, Express/Mail red, Passenger/Mixed blue, MRV to spot red / returning blue, Motor Trolley black, BD Spl returning green, LE to accident spot green, Inspection Special pink, Tower Wagon black, Material Train green, Other green, Track Machine black, Ey. Pass Rake black, BD Spl to spot red, MFD to spot red, MFD returning blue, Long Haul sienna, no-BPC thicker, fourth line dashed) | M     | Encodable as config.                                                                                          |
| Tooltip "Train No & Origin–Dest"                                                                                                                                                                                                                                                                                                                                                                                                                              | M     | Origin/dest are embedded in `TRINID` (e.g. `AADRNDLSUMB …`) but not as fields. ?                              |
| Data provides `COLORCODE` + `PGFLAG` only                                                                                                                                                                                                                                                                                                                                                                                                                     | D     | 9 colour names. `Chocolate` (731 rows), `CADETBLUE`, `Brown`, `Olive`, `Magenta` are not in the manual table. |
| Goods / Pass / Others filters                                                                                                                                                                                                                                                                                                                                                                                                                                 | M L D | `PGFLAG` G/P/O.                                                                                               |

### J. Station markers

| Requirement                                          | Tag              | Notes                                              |
| ---------------------------------------------------- | ---------------- | -------------------------------------------------- |
| Station name colour by class                         | M L              | See B.                                             |
| Line occupancy per station (right panel L1/M2 boxes) | M (screenshot) D | `StationLine.json` gives lines; occupancy derived. |

### K. Arrival/departure points (icons)

| Requirement                                                                    | Tag   | Notes                                                                                                                                                |
| ------------------------------------------------------------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Red icon = arrival / floating point at last reported station; hover shows crew | M L   | Legacy: red dot when last row has arrival but no departure. `LASTRPTFLG='Y'` marks the last reported row (105 trains).                               |
| Blue icon = not departed, shows ETD                                            | M     | ETD not in supplied data (all rows are actual). Legacy draws a blue dot at the start-label anchor for every train — different meaning. **Conflict**. |
| Green icon = departed, shows departure time                                    | M L   | Legacy: green end dot when departed.                                                                                                                 |
| Square = terminating point                                                     | M L D | `DESTNFLAG='Y'` (46 rows). Legacy: 4×4 red square.                                                                                                   |

### L. Detention

| Requirement                                             | Tag   | Notes                                                                                                                                                                                                  |
| ------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Integer in red against station/block section where lost | M L D | Legacy: `LOSS` (block section, drawn at arrival) and `GAIN` (station, drawn at departure); value ≥ 0 → red, < 0 → green; shows `abs(value)`; hides 0; blank/null = no value. Offset ±8px by direction. |
| Field naming is misleading                              | D ?   | `GAIN` holds station gain/loss, `LOSS` holds block-section gain/loss; sign convention positive = lost. Confirm.                                                                                        |

### M. Gain/loss

| Requirement                                                             | Tag | Notes                                  |
| ----------------------------------------------------------------------- | --- | -------------------------------------- |
| Gain in green                                                           | M L | See L.                                 |
| Toggle Gain/Loss                                                        | M L |                                        |
| Legacy "calculated G/L" in train detail grid using MPS × block distance | L ✗ | Needs `WCCGetMPS` data — not supplied. |

### N. Crew information

| Requirement                                                                                                         | Tag | Notes                                                                                        |
| ------------------------------------------------------------------------------------------------------------------- | --- | -------------------------------------------------------------------------------------------- |
| Crew checkbox → crew on train label                                                                                 | M   |                                                                                              |
| Hover floating point → crew info                                                                                    | M   |                                                                                              |
| > 7h duty (configurable) → floating label blinks for 20 s every 1 min (configurable)                                | M   |                                                                                              |
| Legacy "Crew (7Hrs+)": line width 3 at COD ≥ 420, 4 at ≥ 540, only if crew not signed off and train not handed over | L   | **Different behaviour** from manual (thicker line vs blinking label).                        |
| Crew record fields                                                                                                  | D   | `CREWNAME`, `CREWTYPE` (DR/ADR/GD), `SIGNONTIME`, `SIGNOFFTIME`, `COD` (minutes), `CLINAME`. |
| Is 7h measured by `COD` or by now − sign-on?                                                                        | ?   | `COD` appears to be computed at extraction time.                                             |

### O. Loco information

| Requirement                   | Tag | Notes                                                                                                                              |
| ----------------------------- | --- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Loco numbers in label tooltip | L D | `loco.json`: 8,932 rows, only 238 rows (170 trains) match movement. `atchdtchflag` A/D, `locoposn` (multi-loco order), event time. |
| Loco on label                 | ?   | Manual shows loco text in chart screenshots but doesn't specify.                                                                   |

### P. GPS movement

| Requirement                                                            | Tag | Notes                                                                                                                                                                 |
| ---------------------------------------------------------------------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GPS Loco checkbox → highlight GPS-enabled trains                       | M   | No GPS-enabled flag. Proxy available: `ArvlUserID/DepartureUserId = 'GPSDATA'` (RTIS) or `'REMLOT'`. Legacy uses exactly this for its RTIS/REMLOT/GPS type filters. ? |
| GPS Loco Mvmt → plot unattached GPS loco movement; dim everything else | M   | ✗ no data. Legacy endpoint `WCCfetchUnatchLOCOMvmnt`.                                                                                                                 |

### Q. Blocks

| Requirement                                                                                                                                                                 | Tag | Notes                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | -------------------------------------------------------------------------------------------------------------------------- |
| Station block (`CAVSTTN`) or block-section block (`FROMSTTN`–`TOSTTN`)                                                                                                      | D L | 4 station blocks, 9 section blocks.                                                                                        |
| Colour by department: dark red Engg open line, dark green Signal, black "track distribution" (likely _traction distribution_), dark blue integration, dark pink Engg const. | M   | Data codes: `ENGG-OPENLINE`, `SIGNAL`, `TRACTION DISTR.`, `TRACMACHINE`, `POWER`. No colour given for TRACMACHINE/POWER. ? |
| Red part = burst period; dark red line = AST; cyan line = AET; reason as black text                                                                                         | M ? | Needs CC/DD/EE/FF semantics.                                                                                               |
| Legacy: green diagonal hatch, direction-specific pattern, 25% opacity, from `EE` to `CADCLEARTIME` (or now), tooltip with demanded minutes (`EE`→`FF`) and "finished on"    | L   |                                                                                                                            |
| Direction `BB` (UP/DN/BOTH)                                                                                                                                                 | D L |                                                                                                                            |

### R. Cautions

| Requirement                                                                                                              | Tag              | Notes                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Star = both directions / single line; up-triangle = UP line; down-triangle = DN line                                     | M D              | `DRTN` BOTH/UP/DN.                                                                                                         |
| Icon label "P<pass> G<goods>"                                                                                            | M (images) D     | e.g. `P30 G45`; `PASSPEED`/`GDSPEED` (nullable).                                                                           |
| Tooltip: block section, location, speed, from date/time                                                                  | M D              | Legacy also shows reason, dept, to-time.                                                                                   |
| Placement: caution column right of chart at the block section's Y                                                        | M (screenshot) L | Legacy stacks up to 3 icons per Y.                                                                                         |
| Icon colours                                                                                                             | M L              | Manual images: star **green**, up **blue**, down **green**. Legacy: BOTH **red**, UP **green**, DN **blue**. **Conflict**. |
| Display Caution Notify Sttn (default N)                                                                                  | M ✗              | No notify-station data.                                                                                                    |
| "Caution Orders on Chart" horizontal bands coloured by speed (<15 red, 15–30 orange, 30–60 yellow, >60 green, none blue) | L only           | Not in manual.                                                                                                             |

### S. Unusual occurrences

| Requirement                                                                   | Tag | Notes                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Between caution icons and line occupancy, at station/block section            | M   |                                                                                                                                                                                                       |
| Colours: Signal red, Engineering pink, Electrical green, Tele blue, ACF brown | M   | Legacy: SIGG red, ENGG pink, ELEC green, TELE blue, **ACF orange**, **MISC brown**, else black. **Conflict** (ACF).                                                                                   |
| Tooltip: section/block section, type, start time, reason                      | M L | Legacy adds cause, failure type/desc, remark, end time, detention.                                                                                                                                    |
| Data                                                                          | ✗   | Not supplied. Legacy field names known (`STRBLCKSCTNNAME`, `STRSTTN`, `NUMSUBSCTNNO`, `STRUNUSLTYPE`, `STRCAUSE`, `STRFAILURETYPE`, `STRFAILUREDESC`, `STRTTIME`, `ENDTIME`, `RMRK`, `NUMDETENTION`). |

### T. TSL

| Requirement                                                                                         | Tag | Notes                                        |
| --------------------------------------------------------------------------------------------------- | --- | -------------------------------------------- |
| TSL movement as **purple dotted line**                                                              | M   | Legend table p.247. §9.7 says "dotted line". |
| TSL imposition fields (sub section, from/to station, time of introduction, line, cancellation time) | M   |                                              |
| Data                                                                                                | ✗   | Not supplied, not in legacy.                 |

### U. Line occupancy

| Requirement                                      | Tag | Notes                                                                                                                                                                                                     |
| ------------------------------------------------ | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Red occupied / green free / light blue nominated | M   |                                                                                                                                                                                                           |
| Derivation                                       | L D | Legacy: a line is occupied when the train's last reported row (`LASTRPTFLG='Y'`) has arrival, no departure, and `LINENO` matches a `StationLine` line in the same section. Shown only in station tooltip. |
| "Nominated" status                               | ✗   | No data.                                                                                                                                                                                                  |
| Line Occupancy Check preference                  | M   | §3.1.4.                                                                                                                                                                                                   |

### V. Remarks

| Requirement                                                                                                                                                    | Tag | Notes                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | -------------------------------------------------------------------------- |
| General user remark in red at bottom of chart, visible until "To" time reaches chart start                                                                     | M   | Add Remarks (§3.3). **No data supplied** (`remark.json` is train remarks). |
| Train remarks (movement pad / remark form)                                                                                                                     | M D | `remark.json`: 9 rows.                                                     |
| Station remark                                                                                                                                                 | M ? | `EVENT='S'` may be station remark. ?                                       |
| Legacy: "R" markers grouped by `CAVNEWTRAINNAME` (station code or block section), placed at station Y, x at right edge unless `EVENT='T'` (then at event time) | L   | `CAVNEWTRAINNAME` holds a location despite its name. ?                     |
| Remarks Font Size (default 7.25)                                                                                                                               | M   |                                                                            |

### W. EPEN

| Requirement                                                                 | Tag | Notes                                                     |
| --------------------------------------------------------------------------- | --- | --------------------------------------------------------- |
| Right-click → Write Pad → pen input → Save → "MSG" label on chart           | M   |                                                           |
| Right-click → Message Show → all messages of time period; click MSG to view | M   |                                                           |
| Printed on print chart                                                      | M   |                                                           |
| Storage/API, message anchor (time? position?)                               | ✗   | Not specified, no data. Will isolate behind an interface. |

### X. MSM

| Requirement                                                               | Tag | Notes                                                                                                                                                      |
| ------------------------------------------------------------------------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MSM checkbox; click a traversed block-section segment                     | M   |                                                                                                                                                            |
| Separate window plotting mid-section location vs time, speed/time tooltip | M   | Screenshot: "Mid Section" window with distance-time curve and Time–Speed list at ~30 s intervals.                                                          |
| Purple dotted line (legend)                                               | M ? | Legend row ambiguity: "MSM … show purple dotted line" vs "TSL Movement … purple dotted". Pages 246–247 layout suggests purple dotted belongs to **TSL**. ? |
| Data                                                                      | ✗   | No mid-section samples supplied.                                                                                                                           |

### Y. Zoom

| Requirement                                   | Tag | Notes |
| --------------------------------------------- | --- | ----- |
| Zoom selected area, mouse as magnifying glass | M   |       |
| Legacy: whole-page CSS zoom, 4 steps          | L   |       |

### Z. Pan

| Requirement                                                   | Tag | Notes |
| ------------------------------------------------------------- | --- | ----- |
| Dragging chart for analysis (implied by Freeze description)   | M   |       |
| Legacy: Pre/Next hour buttons (Previous mode), browser scroll | L   |       |

### AA. Freeze

| Requirement                                                  | Tag | Notes          |
| ------------------------------------------------------------ | --- | -------------- |
| Stop chart updates while dragging for analysis; configurable | M   | Not in legacy. |

### AB. Train selection

| Requirement                                                                                               | Tag | Notes                                                            |
| --------------------------------------------------------------------------------------------------------- | --- | ---------------------------------------------------------------- |
| Select train; next movement details top-left; choose X (time) and Y (station) to report arrival/departure | M   | **Write operation** (reports movement). No write API supplied. ? |
| Legacy search by train no./name → isolates train, opens station-wise timing grid                          | L   |                                                                  |

### AC. Hover / tooltip

| Requirement                                   | Tag | Notes                        |
| --------------------------------------------- | --- | ---------------------------- |
| Floating point → crew                         | M   |                              |
| Caution, unusual, block tooltips              | M L |                              |
| Train line tooltip: name (no.), average speed | L   | Avg of `CANSPEED` over rows. |
| Siding activity tooltip on chart              | M ✗ | No siding data.              |

### AD. Forecast controls

| Requirement                                                                                                             | Tag | Notes                                              |
| ----------------------------------------------------------------------------------------------------------------------- | --- | -------------------------------------------------- |
| BF — basic forecast of visible trains                                                                                   | M   | Algorithm for BF not described. ✗ data.            |
| MF — "select manual option" then MF converts full forecast to manual; drag train to set arr/dep; **not saved anywhere** | M   | Client-side only. Feasible once a forecast exists. |
| Single forecast — right-click train label → forecast                                                                    | M   |                                                    |
| FF — full forecast; algorithm described in prose                                                                        | M   | Server-side (DB, NRT, occupancy). ✗ data.          |
| CMI — manual precedence/crossing then regenerate                                                                        | M   | Requires server.                                   |
| Halt — "Train Manual Halt" form (halt on station, delay in block section), reflected on reload                          | M   | Requires server.                                   |
| Reset                                                                                                                   | M   |                                                    |
| WFS — save wrong forecast for analysis                                                                                  | M   | Requires server.                                   |
| Auto Refresh Forecast (default N)                                                                                       | M   |                                                    |

### AE. Toolbar controls

Manual: Crew, Gps Loco, Speed, Gain/Loss, Goods, Pass, Others, Zoom, All, UP, DN, MSM, GPS Loco Mvmt, Freeze, L, S, Manual, Halt Data, WFS, MF, BF, FF, CMI, Reset (screenshot also shows "HLT"). Auto Refresh (BTC users), Performance button (Show Time Y/N).
Legacy: Current/Previous/24 Hrs, Division, Station, Board, Date, From/To, Show, Pre/Next, Search/Reset, Direction, Reports (Running trains grid, Unattached GPS loco), Type (All/G/P/O/Stable/Siding/GPS/RTIS/REMLOT/Loco/Possible attach/Caution on chart), Speed, G/L, Crew (7Hrs+), Side panel (Caution/Unusual), Line thickness, Zoom, Save Chart.

| Control                                  | Tag   | Behaviour known?                                                           |
| ---------------------------------------- | ----- | -------------------------------------------------------------------------- |
| Speed                                    | M L D | Legacy: `CANSPEED` at departure point, UP orange / DN brown.               |
| Goods/Pass/Others                        | M L D | Manual: checkboxes "view only X" — combination semantics (multi-select?) ? |
| All/UP/DN                                | M L D |                                                                            |
| L (legends: train types, line occupancy) | M     | Content known from manual tables.                                          |
| S (handover/takeover division summary)   | M ?   | Content/format not specified; no data.                                     |
| Performance ("Show Time")                | M ?   | Behaviour not described.                                                   |

### AF. Configuration / settings

All §3.1.1–3.1.4 parameters listed above are **M**. Defaults are documented except Chart Idle Refresh Time. Server-side ones (paths, server name) are out of scope.

### AG. Printing / export

| Requirement                                                                                                      | Tag | Notes                                          |
| ---------------------------------------------------------------------------------------------------------------- | --- | ---------------------------------------------- |
| Print Chart: shift start time, shift hours, Speed, Gain/Loss, preview; controller name at bottom; movable labels | M   |                                                |
| Print Chart crew / load summary preferences                                                                      | M   |                                                |
| EPEN messages printable                                                                                          | M   |                                                |
| Chart Save Time (auto-save to file every N min)                                                                  | M ? | Desktop-app feature; web equivalent undefined. |
| Legacy: "Save Chart" SVG → PNG (jsPDF/JPG disabled)                                                              | L   |                                                |
| Controller name source                                                                                           | ✗   |                                                |

### AH. Refresh / live updates

| Requirement                                                                               | Tag | Notes                   |
| ----------------------------------------------------------------------------------------- | --- | ----------------------- |
| Auto Refresh Chart for BTC users; Auto Refresh Enable (default N)                         | M   |                         |
| Chart Idle Refresh Time                                                                   | M   |                         |
| Legacy: full re-fetch every 3 min when user flag `ssChartAUD='Y'`; session-expiry warning | L   | Full redraw every time. |

---

## 3. Manual vs legacy — conflicts (not resolved)

| #   | Topic                  | Manual                                                            | Legacy                                    | Proposed default (pending your call)  |
| --- | ---------------------- | ----------------------------------------------------------------- | ----------------------------------------- | ------------------------------------- |
| C1  | Siding label colour    | Red                                                               | DeepPink                                  | Manual (red)                          |
| C2  | Caution icon colours   | Star green, UP blue ▲, DN green ▼ (from images)                   | BOTH red ★, UP green ▲, DN blue ▼         | Manual                                |
| C3  | Unusual ACF colour     | Brown                                                             | Orange (MISC brown)                       | Manual; MISC → ?                      |
| C4  | Blue point             | Train not yet departed, shows ETD                                 | Blue dot at every train's start label     | Manual                                |
| C5  | Crew over-duty         | Floating label blinks 20 s every 1 min after 7h                   | Line width 3 (≥7h) / 4 (≥9h)              | Manual; legacy variant optional?      |
| C6  | Block visual           | Dept colour, red burst, dark-red AST, cyan AET, black reason text | Green hatch by direction, 25% opacity     | Manual (needs field semantics)        |
| C7  | Inter-section spacing  | Factor 1.5                                                        | Not applied                               | Manual                                |
| C8  | Station spacing source | Not specified                                                     | `MANDSPLDIST` clamped 4–15                | Legacy (only spec available)          |
| C9  | Train colour           | 26-type table / BS-vs-TT base                                     | `COLORCODE` from data                     | `COLORCODE` until a type field exists |
| C10 | Time precision         | 10-min grid                                                       | Seconds dropped                           | Keep seconds                          |
| C11 | Zoom                   | Selected-area magnifier                                           | Page CSS zoom                             | Manual + continuous zoom              |
| C12 | Chart window           | Chart View Hours (3/4–8) + Plot Hours                             | Current = hour+1 − 6h; Previous 1–8h; 24h | ?                                     |

---

## 4. Data mapping

Common: timestamps are `dd-mm-yy HH:mm[:ss]`, two-digit year → 20yy, IST wall-clock (legacy parses as local; one path uses `-0530`). A few outliers (`27-12-24`, `…-12-25`, `…-03-26`) must be tolerated.

### movement.json → Train, TrainEvent (3,390 rows, 196 trains, ordered by `TRINID`, `SEQNO`)

| Field                             | Domain                                       | Notes                                                                                              |
| --------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `TRINID`                          | `Train.id`                                   | Also encodes origin/dest/date.                                                                     |
| `TRAINNO`, `TRAINNAME`            | `Train.number`, `Train.name`                 | `TRAINNO` blank for 681 rows (LE etc.) → label uses name.                                          |
| `DIRECTION`                       | `Train.direction` per event                  | 19 trains change direction mid-run. Keep per-event.                                                |
| `PGFLAG`                          | `Train.category` G/P/O                       |                                                                                                    |
| `COLORCODE`                       | `Train.colour`                               | Colour name.                                                                                       |
| `SUBSCTNID`                       | `event.sectionId`                            | → `Board.sections`.                                                                                |
| `SEQNO`                           | `event.sequence`                             | Gaps are normal.                                                                                   |
| `STTNCODE`                        | `event.stationCode`                          | 8 codes not on board (NDLS, DLI, DBSI, PCWD, IBBM, PCRG, TPAP, NFLD) → off-board, skip with count. |
| `DPRTARVLTIME` / `DPRTTIME`       | `event.arrival` / `event.departure`          | Nullable.                                                                                          |
| `ISARVLACTUAL` / `ISDEPTACTUAL`   | `event.arrivalKind` / `departureKind`        | All `A`. Other values unknown.                                                                     |
| `SCHARVL` / `SCHDPRT`             | `event.scheduled{Arrival,Departure}`         | WTT.                                                                                               |
| `LOSS`                            | `event.sectionGainLoss` (min)                | String; `''`/null = none.                                                                          |
| `GAIN`                            | `event.stationGainLoss` (min)                | String; see L.                                                                                     |
| `LT`                              | `event.lateMinutes`                          |                                                                                                    |
| `LASTRPTFLG`                      | `event.isLastReported`                       |                                                                                                    |
| `DESTNFLAG`                       | `event.isDestination`                        |                                                                                                    |
| `PREVSTTNBRDID` / `NXTSTTNBRDID`  | `event.prevBoardId` / `nextBoardId`          | Handover/takeover arrows.                                                                          |
| `BLCKSCTN`                        | `event.nextBlockSection`                     |                                                                                                    |
| `CANSPEED`                        | `event.speedKmph`                            | Range includes −128 (sentinel?) ?                                                                  |
| `LINENO`, `LINETYPE`              | `event.lineNo`, `event.lineType` (NRML/REVS) |                                                                                                    |
| `ArvlUserID` / `DepartureUserId`  | `event.arrivalSource` / `departureSource`    | `GPSDATA` → RTIS, `REMLOT` → REMLOT, else manual user.                                             |
| `TRAINCMPLDATE`, `TOTALALLOWANCE` | `Train.completedAt`, `event.totalAllowance`  |                                                                                                    |

### BoardDetails.json → Board, Section, Station (32 rows)

`MANDSPLNUMB` section id · `MANDSPLSQNC` section order · `MANSTTNSQNC` station order · `MAVSTTNCODE` code · `MANDISTFROMREFSTTN` km from reference (errors) · `MANACTLDIST` actual distance · `MANDSPLDIST` display distance (spacing) · `MACCLASSFLAG` B/S/(X).
Missing: board id/name (other files say `BoardID = 3`), station full names, siding→parent station.

### StationLine.json → StationLine (146 rows)

`SubSectionId`, `MAVSTTNCODE`, `lineno`, `LINENAME`, `LINETYPE` (MAIN LINE / LOOP LINE / Y), `SidingFlag` (T/S), `StaClass`, `LINEAD` (99…91 — ? meaning), distances duplicated from board.

### block.json → Block (13 rows)

`CAVBLCKRSTNID` id · `CANSCTNNUMB` section · `CAVSTTN` or `FROMSTTN`/`TOSTTN` · `BB` direction · `CAVBLCKRSTNCODE` department code · `CC`/`DD`/`EE`/`FF` ? · `CACEXTNBRSTFLAG` ? · `CAVBLCKRSTNRMRK` reason · `CADPRMTEXTNDENDTIME` permitted extended end (all null) · `CADCLEARTIME` clearance.

### caution.json → Caution (39 rows)

`SECTION`, `BLOCKSECTION` (block section or station), `SUBSCTNUMB`, `DRTN`, `LINENO`, `PASSPEED`, `GDSPEED`, `LOCATION` (km/pole), `FROMDATETIME`, `TODATETIME`, `REASONDESC`, `DEPTCODE`, `DAYHH` (days/hours in force), `BOARDID`. `LINE` always null.

### crew.json → CrewMember (53 rows, 19 trains, 3 joinable)

`TRAINID`, `CREWNAME`, `CREWTYPE`, `SIGNONTIME`, `SIGNOFFTIME`, `COD` (minutes on duty), `CLINAME`.

### loco.json → LocoAssignment (8,932 rows; filter to movement trains)

`trainid`, `loconumb`, `atchdtchflag` (A/D), `locoposn`, `CADEVENTRPTGTIME`. Most rows are irrelevant — the adapter filters by trains present.

### remark.json → TrainRemark (9 rows)

`CAVTRAINID`, `TrainName`, `CAVNEWTRAINNAME` (location), `CANSTTNSQNCNO`, `EVENT`, `CAVREMARK`, `CAVUSERID`, `CADEVENTRPTGTIME`, `CAVDVSNCODE`, `BoardID`.

### Legacy API surface (for the future API adapter)

All `POST` JSON with `{strToken, Dvsn, Board, frmDateTime, toDateTime}` (names vary): `WCCGetMvmntDetails`, `WCCGetBoardDetails`, `WCCGetSttnLineDetails`, `WCCGetCrewDetails`, `WCCGetLocoDetails`, `WCCGetRemrks`, `WCCgetblockDataonCharts`, `WCCfetchCautionDataonChart`, `WCCfetchUnusalDataonChart`, `WCCfetchUnatchLOCO`, `WCCfetchUnatchLOCOMvmnt`, `WCCGetStlbDetails`, `WCCCutnLossdtls`, `WCCGetMPS`, `WCCfetchDvsnBoardDetails`, `fetchDvsnBoardSttns`, `getBrdFrmSttn`, `WCCfetchAllTrainInfoDetails`, `WCCuseracesstrail`. The eight supplied JSON files match the response shapes of the first seven, which confirms they are API snapshots.

---

## 5. Domain model (proposed)

Framework-free TypeScript in `current-chart/domain`. Times are epoch milliseconds (IST parsing done once in adapters). Only fields backed by sources.

```ts
type Direction = 'UP' | 'DN';
type TrainCategory = 'GOODS' | 'PASSENGER' | 'OTHER';
type EventSource = 'MANUAL' | 'RTIS' | 'REMLOT';

interface CurrentChartModel {
  board: Board;
  trains: Train[];
  blocks: Block[];
  cautions: Caution[];
  trainRemarks: TrainRemark[];
  // Present as types; empty until data exists:
  unusualOccurrences: UnusualOccurrence[];
  tsl: TslWorking[];
  gpsLocoMovements: GpsLocoMovement[];
  generalRemarks: ChartRemark[];
  epenMessages: EpenMessage[];
  asOf: number; // snapshot "now"
  diagnostics: AdapterDiagnostic[]; // skipped rows, unknown stations, bad dates
}

interface Board {
  id?: number;
  sections: Section[];
  stations: Station[];
} // stations in display order
interface Section {
  id: number;
  order: number;
  stationCodes: string[];
}
interface Station {
  code: string;
  sectionId: number;
  order: number;
  kind: 'BLOCK' | 'SIDING' | 'OTHER';
  isSectionBoundary: boolean;
  displayDistance: number;
  kmFromReference: number;
  actualDistance: number;
  lines: StationLine[];
}
interface StationLine {
  lineNo: number;
  name: string;
  type: 'MAIN' | 'LOOP' | 'SIDING' | 'UNKNOWN';
}

interface Train {
  id: string;
  number?: string;
  name: string;
  category: TrainCategory;
  colour: string;
  events: TrainEvent[]; // actual, in SEQNO order
  forecast: ForecastPoint[]; // empty until a forecast source exists
  crew: CrewMember[];
  locos: LocoAssignment[];
}
interface TrainEvent {
  seq: number;
  stationCode: string;
  sectionId: number;
  direction?: Direction;
  arrival?: number;
  departure?: number;
  scheduledArrival?: number;
  scheduledDeparture?: number;
  sectionGainLoss?: number;
  stationGainLoss?: number;
  lateMinutes?: number;
  speedKmph?: number;
  lineNo?: number;
  wrongLine: boolean;
  isLastReported: boolean;
  isDestination: boolean;
  prevBoardId?: number;
  nextBoardId?: number;
  arrivalSource?: EventSource;
  departureSource?: EventSource;
}
interface ForecastPoint {
  stationCode: string;
  sectionId: number;
  arrival?: number;
  departure?: number;
  origin: 'BASIC' | 'FULL' | 'SINGLE' | 'MANUAL';
}

interface CrewMember {
  name: string;
  type: string;
  signOn: number;
  signOff?: number;
  minutesOnDuty: number;
  controller?: string;
}
interface LocoAssignment {
  locoNumber: string;
  attached: boolean;
  position: number;
  reportedAt: number;
}

interface Block {
  id: string;
  sectionId: number;
  direction: Direction | 'BOTH';
  location: { station: string } | { from: string; to: string };
  department: string;
  reason: string;
  permitted: { start?: number; end?: number };
  actual: { start?: number; end?: number };
  clearedAt?: number;
  permittedExtendedEnd?: number;
  flag: string;
}
interface Caution {
  sectionId: number;
  location: { station: string } | { from: string; to: string };
  direction: Direction | 'BOTH';
  lineNo?: string;
  passengerSpeed?: number;
  goodsSpeed?: number;
  kmLocation: string;
  from: number;
  to?: number;
  reason: string;
  department: string;
  inForce: string;
}
interface TrainRemark {
  trainId: string;
  trainName: string;
  locationCode: string;
  remark: string;
  user: string;
  at: number;
  event?: string;
}
```

Derived (application layer, not stored): line occupancy, train visibility per filters, crew-over-duty, handover/takeover arrows, GPS-enabled (proxy).

---

## 6. Architecture (proposed)

```
JSON files ──┐                          (later) HTTP API ──┐
             ▼                                              ▼
   current-chart/adapters/json/*   ──validate──▶  domain (CurrentChartModel)
                                                          │
             current-chart/application  (filters, occupancy, selection, freeze, refresh, config)
                                                          │
             current-chart/engine  (scales, viewport, zoom/pan, geometry, hit-test)  — pure TS, unit-tested
                                                          │
             current-chart/rendering/types  (ChartRenderModel — plain geometry + style)
                                                          │
             current-chart/rendering/konva  (KonvaRenderer — the only renderer)
                                                          │
             React UI shell (toolbar, panels, dialogs, tooltips as DOM overlays)
```

Key decisions:

- **Data source boundary**: `ChartDataSource` interface → `loadSnapshot(query): Promise<RawChartSnapshot>`; `JsonFileDataSource` now, `ApiDataSource` later. Adapters (one per file) validate with a schema library (**zod**, small and typed — flag if you'd rather hand-roll guards) and emit domain objects + diagnostics. Nothing downstream sees raw field names.
- **Engine** (`CurrentChartEngine`): owns `TimeScale` (ms ↔ x, px/min), `StationScale` (station/section ↔ y with display-distance clamp and section gap factor), `Viewport` (zoom k, pan offset, clamping), and produces geometry: `getTrainGeometry`, `getForecastGeometry`, `getVisibleTimeRange`, `getVisibleStations`, `getCurrentTimePosition`, `hitTest` (spatial grid index over segments/points). All pure; all unit-tested.
- **Render model**: flat, typed primitives grouped by layer (`background`, `grid`, `stations`, `movement`, `overlays`, `annotations`, `interaction`). Each item has a stable `id` so the renderer can diff instead of rebuild.
- **Renderer boundary**: a small interface — `mount(container)`, `update(model, changedLayers)`, `setViewport(t)`, `onPointer(handler)`, `destroy()`. `KonvaRenderer` implements it. No Canvas2D/Pixi code.
- **Konva layering** (5 layers): Background (grid, time bands, shading — `listening:false`, cached), Infrastructure (station lines, blocks, cautions, TSL), Movement (trains, points, labels), Annotation (remarks, unusual, EPEN MSG), Interaction (hover, selection, current-time line). Zoom/pan = stage transform, not re-layout, except when zoom crosses a label-density threshold. Hit detection uses the engine's spatial index rather than Konva's per-shape hit canvas for thousands of lines.
- **Axes**: station names on left/right and time labels top/bottom stay fixed while the plot pans. Implemented as separate thin Konva stages/layers synced to the viewport.
- **React**: toolbar, filters, dialogs, tooltips (DOM overlay positioned from engine coordinates), config panel. State: `useReducer` + one context for chart app state; no Redux. Domain model held in a store object outside React render; React subscribes to derived slices.
- **Config**: `configuration/` holds manual defaults (Chart View Hours, Plot Hours, forecast colour/opacity, font sizes, crew threshold, blink cadence, section gap factor) and the train-visual table — one place for all colours.
- **Services**: `ExportService` (Konva `toDataURL` → PNG/PDF), `RefreshService` (poll + freeze gating), `EpenStore` interface (in-memory impl), `ForecastProvider` interface (no-op / fixture impl).

Folder layout follows your §28 exactly.

---

## 7. Unknowns / questions

Blocking or strongly shaping Phase 2–3:

1. **Train colour source (C9)**: use `COLORCODE` from data as the line colour (legacy behaviour), with the manual table held in config for when a type code arrives? Or is there a train-type code I should expect from the API?
2. **Conflicts C1–C6, C12**: default to manual in each case?
3. **Block timestamps**: what are `CC`, `DD`, `EE`, `FF`, `CACEXTNBRSTFLAG`? Which is AST, AET, burst?
4. **"As-of" time** for JSON mode: latest event in data (21-09-2026 ~07:55), or a fixed value you choose?
5. **Missing datasets**: can you supply samples for unusual occurrences, TSL, forecast (any shape — even the old API's), GPS unattached loco movement, MSM mid-section samples, general chart remarks? Without them those features are built as typed interfaces + fixtures only and marked in the gap report.
6. **Write operations** (train movement through chart, EPEN save, WFS, Halt, CMI): out of scope for this stage (read-only chart + stubs), or should I define write-service interfaces now?
7. **Goods/Pass/Others**: independent checkboxes (multi-select union) or exclusive?

Lower priority (can proceed with a documented assumption):

8. `GAIN`/`LOSS` sign convention (assume legacy: ≥ 0 = loss, red).
9. GPS-enabled = RTIS/REMLOT-reported events (legacy proxy)?
10. Siding parent station (not in data): place sidings after the preceding block station in board order?
11. `CANSPEED` negative values (−128): treat ≤ 0 as no speed?
12. Legacy-only features (search, Previous/24h modes, Caution-on-chart bands, running-train grid, stable/siding views): include, defer, or drop?
13. Browser target: modern Chromium only?

---

## 8. Proposed Phase 2 scope (awaiting approval)

- Vite + React 18 + TypeScript strict, Konva + react-konva, Vitest + Testing Library, ESLint (typescript-eslint strict) + Prettier, zod.
- Folder skeleton per §28; domain types from §5; adapter interfaces + per-file schema definitions; `ChartDataSource` interface; JSON fixtures copied into `src/data/`.
- `npm run lint`, `npm test`, `npm run build` green. No chart rendering yet.
