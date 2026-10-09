# ROUTE RACE architecture

## Purpose

Paint a weighted grid, predict seeded challenges and design cost-gap counterexamples. Compare BFS, Dijkstra, A* and a separately labeled Weighted A* through frontier snapshots, steps, path cost and unreachable states.

## Structure

Independent static GitHub Pages site at /route-race/. dist/src/model.js owns pure calculation and map codecs; dist/src/achievements.js owns pure completion rules; dist/src/records.js owns the private storage boundary; dist/src/progress.js owns the allowlisted gallery-summary boundary. dist/src/app.js owns UI, bounded inputs, playback and page lifecycle; dist/styles.css owns responsive presentation. Pure deterministic graph search -> editable grid/trace renderer; animation is playback, not a speed benchmark.

The pure model owns seeded RR1 map generation, replay-code validation, search rules, trace snapshots and mission evaluation. It has no UI imports, randomness from the clock, DOM or storage access. The UI obtains fresh uint32 seeds with browser crypto and invokes these deterministic rules. Browser randomness chooses a new attempt; identical replay code plus heuristic weight reproduces the unedited search.

Movement remains four-neighbor, excluding the start. RR1 generation and the original build mission retain entry costs 1/5; free editing and RRM1 imports accept integer costs 1..99 (wall -1). The brush accepts 2..99 without changing older cells. BFS minimizes steps; Dijkstra and Manhattan A* minimize cost because the minimum entry cost remains at least 1. Weighted A* is a fourth bounded graph-search strategy with g + wh, w in {1, 1.5, 2, 3, 4}, no closed-cell reopening and goal-pop termination. w=1 equals A*; w>1 carries no optimality or approximation-ratio claim. All strategies use unique open entries and discovery-order ties (right, down, left, up). At most width*height cells expand; validation caps 30*20. New maps remain 20*12; imported grids retain their exact dimensions. Frontier snapshots use at most O(V²) index entries per strategy, with only five scored candidates and four relaxations per step.

All five challenge generators construct reachable maps without unbounded retries. User edits may disconnect them. Predictions lock on calculation and are checked against computed comparisons; the build mission uses a blank 20*12 baseline, fixed endpoints (101/118), 1/5 terrain, 1-8 net changed cells and a BFS-vs-Dijkstra cost gap of at least 8. Changes to map or weight invalidate computed results and predictions. Undo retains at most 32 editor snapshots in transient memory, including import replacement and its prior board/settings/baseline. Import provenance or hint use cannot be undone into independent completion eligibility. Playback schedules animation frames only while playing, pauses when hidden and cancels on page exit; reduced-motion users start paused.

No backend, account, tracking, cookies, external fonts or runtime API. RRM1 is explicit local text export/import, never a URL, upload or automatic clipboard read. The ASCII code is at most 8192 characters and carries exactly {version:1,width,height,tiles,start,end,terrainCost,weight}. Decode checks all keys/types, 2..30 by 2..20 dimensions, exact dense tile count, integer costs -1 or 1..99, non-wall endpoints, brush bounds and the five w values before UI mutation. All cells, endpoints and settings survive export; seeds, predictions, results and undo do not. RR1 rules remain supported. Optional page-scoped WebMCP uses the validated paint/solve actions; those tool actions do not earn independent completion.

## Approved local persistence / D08-D10

Only an independently completed original build mission persists automatically. UI-originated blank-map design without hints/imports/examples is eligible; correct prediction, initial view, example solve and imported maps earn nothing. The private localStorage key route-race-achievement-v1 holds {version:1,build:<canonical successful RRM1 witness>} at most 8192 characters. No score, seed, action history or private timestamp is trusted. achievements.js re-solves the witness against the original baseline on reload before deriving completed=1, total=1. There is no saved-map library in this change; working edits remain transient.

The same-origin gallery contract uses only localStorage key web-lab-progress-v1 with {version:1,apps:{repoId:{completed,total,updatedAt}}}. progress.js caps the record to 8192 characters, exactly 15 known IDs, integer 0<=completed<=total<=1000, and canonical ISO UTC timestamps. Read-modify-write preserves every peer record; unknown keys, invalid records, denied storage and quota failures fail safely without replacing corrupt peer data. A new summary timestamp is written only for an actual completion or missing/stale own aggregate recovered from a valid witness. Ordinary reloads retain an existing matching timestamp. A fresh view writes no zero record. Missing/invalid own evidence removes only the own stale aggregate if it can be safely parsed.

Explicit erase removes route-race-achievement-v1 and only apps["route-race"] from the summary; other apps and keys are retained. Private-write and summary-write failures are reported separately. This is a device-local learning marker, not authenticated proof; browser users can modify their own storage. There is no public ranking or backend. Shared origin implies same-origin apps can technically access storage, although the gallery contract permits reading only the allowlisted aggregate. Cross-tab localStorage updates are not transactional.

No eval, user HTML injection or remote embeds. External links use noopener/noreferrer. CSP restricts connections and execution; GitHub hosting logs are separate. Only dist is deployed. UTF-8 without BOM / CRLF. Preserve all other repositories.

## Visual direction

blue/violet map and race-lane comparison. The working surface opens immediately; no marketing landing page ahead of controls. Keyboard controls, touch input, readable labels and reduced motion are part of the UI. Diagrams/canvas represent actual computed state rather than decorative or fictional results.
