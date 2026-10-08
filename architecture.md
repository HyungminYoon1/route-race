# ROUTE RACE architecture

## Purpose

Paint a weighted grid and compare BFS, Dijkstra and A* traces, steps, path cost and unreachable states.

## Structure

Independent static GitHub Pages site at /route-race/. dist/src/model.js owns pure calculation; dist/src/app.js owns UI, bounded inputs, playback and page lifecycle; dist/styles.css owns responsive presentation. pure deterministic graph search -> editable grid/trace renderer; animation is playback, not a speed benchmark.

No backend, account, tracking, cookies, visitor persistence, external fonts or runtime API. Input and experiments are transient page memory; explicit image download is user-owned local output, not server storage. Optional page-scoped WebMCP tools use the same validated state/actions as the visible controls, and feature-detect unsupported browsers. Tool summaries contain no private image bytes.

No eval, user HTML injection or remote embeds. External links use noopener/noreferrer. CSP restricts connections and execution; GitHub hosting logs are separate. Only dist is deployed. UTF-8 without BOM / CRLF. Preserve all other repositories.

## Visual direction

blue/violet map and race-lane comparison. The working surface opens immediately; no marketing landing page ahead of controls. Keyboard controls, touch input, readable labels and reduced motion are part of the UI. Diagrams/canvas represent actual computed state rather than decorative or fictional results.
