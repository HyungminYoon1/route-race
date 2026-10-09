# ROUTE RACE architecture

## Purpose

Paint a weighted grid, predict seeded challenges and design cost-gap counterexamples. Compare BFS, Dijkstra, A* and a separately labeled Weighted A* through frontier snapshots, steps, path cost and unreachable states.

## Structure

Independent static GitHub Pages site at /route-race/. dist/src/model.js owns pure calculation; dist/src/app.js owns UI, bounded inputs, playback and page lifecycle; dist/styles.css owns responsive presentation. pure deterministic graph search -> editable grid/trace renderer; animation is playback, not a speed benchmark.

The pure model owns seeded RR1 map generation, replay-code validation, search rules, trace snapshots and mission evaluation. It has no UI imports, randomness from the clock, DOM or storage access. The UI obtains fresh uint32 seeds with browser crypto and invokes these deterministic rules. Browser randomness chooses a new attempt; identical replay code plus heuristic weight reproduces the unedited search.

Movement remains four-neighbor, entry cost 1 or 5, excluding the start. BFS minimizes steps; Dijkstra and Manhattan A* minimize cost. Weighted A* is a fourth bounded graph-search strategy with g + wh, w in {1, 1.5, 2, 3, 4}, no closed-cell reopening and goal-pop termination. w=1 equals A*; w>1 carries no optimality or approximation-ratio claim. All strategies use unique open entries and discovery-order ties (right, down, left, up). At most width*height cells expand; validation caps 30*20, the editor remains 20*12. Frontier snapshots use at most O(V²) index entries per strategy, with only five scored candidates and four relaxations per step.

All five challenge generators construct reachable maps without unbounded retries. User edits may disconnect them. Predictions lock on calculation and are checked against computed comparisons; a build mission uses a blank baseline, fixed endpoints, 1-8 net changed cells and a BFS-vs-Dijkstra cost gap of at least 8. Changes to map or weight invalidate computed results and predictions. Undo retains at most 32 board snapshots in transient memory. Playback schedules animation frames only while playing, pauses when hidden and cancels on page exit; reduced-motion users start paused.

No backend, account, tracking, cookies, visitor persistence, external fonts or runtime API. Input and experiments are transient page memory; explicit image download is user-owned local output, not server storage. Optional page-scoped WebMCP tools use the same validated state/actions as the visible controls, and feature-detect unsupported browsers. Tool summaries contain no private image bytes.

No eval, user HTML injection or remote embeds. External links use noopener/noreferrer. CSP restricts connections and execution; GitHub hosting logs are separate. Only dist is deployed. UTF-8 without BOM / CRLF. Preserve all other repositories.

## Visual direction

blue/violet map and race-lane comparison. The working surface opens immediately; no marketing landing page ahead of controls. Keyboard controls, touch input, readable labels and reduced motion are part of the UI. Diagrams/canvas represent actual computed state rather than decorative or fictional results.
