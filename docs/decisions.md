# Decisions

## D08 — Full edited-map export/import and bounded undo / 2026-10-09

- Context: the user authorized full-map sharing; RR1 only reproduces a generator seed and loses edits/endpoints/settings.
- Options: change RR1; seed-only codes; URL uploads; versioned bounded local text.
- Decision: retain RR1 unchanged and introduce ASCII RRM1 JSON with exactly version,width,height,tiles,start,end,terrainCost,weight. Max 8192 characters, grid 2..30 by 2..20, exact dense tile count, strict fields/types/costs/endpoints/settings. Validate fully before state replacement. Export/copy/import require visible controls; clipboard write occurs only on copy. No network/file upload. Import enters observation/prediction mode and cannot award completion. At most 32 transient editor snapshots include prior import state; undo restores board/settings/baseline but cannot clear hint/import provenance.
- Rationale: reproduce actual deterministic traces, including edited maps, without payload guessing or server state.
- Affected: model.js, app.js, index.html, styles.css, share tests, architecture.md, README.md.
- Follow-up review: version any incompatible codec change. Saved map library is optional and not implemented. Clipboard denial falls back to selecting text for manual copy.

## D09 — Custom terrain costs without changing the campaign / 2026-10-09

- Context: the user requires sharing custom weights as well as Weighted A*'s factor.
- Options: preserve only costs 1/5; arbitrary floating costs; bounded integer costs with separate fixed mission rules.
- Decision: free editor/model accept wall -1 or entry cost 1..99; brush 2..99. Existing cells retain their own cost when the brush changes. RR1 generation and original build mission remain 1/5, 20x12 and original endpoints. Build-mode brush is locked to 5. A* keeps Manhattan h because costs remain >=1. No change to neighbors, tie order, stop rule or Weighted A* factor set.
- Rationale: share the full weighted grid while preserving all old campaign solutions and optimality assumptions.
- Affected: model.js, achievements.js, app.js, index.html, architecture.md, share/oracle tests.
- Follow-up review: new cost/movement rules require new proof and code version. Imported custom maps are observations, never independent mission evidence.

## D10 — Verified device-local completion and minimal gallery aggregate / 2026-10-09

- Context: the user explicitly approved bounded local persistence and the common web-lab-progress-v1 contract. This supersedes D02/D07's no-persistence boundary only for the keys and purpose below.
- Options: count visits/imports/predictions; trust a completion boolean; retain all runs; store one bounded successful original-build witness and revalidate it.
- Decision: total=1 represents the original build mission, not five random prediction families. Only a visible UI calculation of an independent blank-map design without hints/imports/examples/tool paint/solve can persist a witness. Recompute BFS/Dijkstra and original constraints on write/reload. route-race-achievement-v1 stores version plus a canonical successful map (<=8192 characters). The gallery summary contains only completed,total,updatedAt, validated across the 15 known repo IDs, max 8192 characters, exact schema, bounded integers and canonical ISO timestamps. No zero record on initial view; no timestamp rewrite when counts match; no data beyond the actual successful witness. Remove only own aggregate on erase or invalid/missing own witness. Storage exceptions leave calculation usable and surface partial failures.
- Rationale: durable counts come from executable evidence, while the gallery never needs seeds, actions, names or map payloads. One successful witness bounds retained data. The summary is a local marker rather than an identity/ranking service.
- Affected: achievements.js, records.js, progress.js, app.js, index.html, progress tests, architecture.md, README.md.
- Follow-up review: same-origin storage is not isolated from sibling apps and local users can alter it; gallery must follow the aggregate-only contract. Cross-tab read-modify-write is not atomic. No public ranking/provisioning/account access. Corrupt peer aggregates are preserved instead of overwritten; report failure for integration review.

## D11 — Concise interface copy / 2026-10-09

- Context: the user approved removing promotional, AI-like and repeated interface text.
- Options: keep repeated coaching; remove all explanations; keep controls/objectives/algorithm facts and storage disclosure.
- Decision: remove slogans, English eyebrow labels, idle coaching, repeated results advice and footer invitation. Keep real expansions/costs, exact objectives, optimality meaning, deterministic tie rules, clipboard/storage boundaries and failure feedback. Detailed rules remain collapsible.
- Rationale: the editor and actual traces communicate the task directly.
- Affected: app.js, index.html, styles.css.
- Follow-up review: main captures actual desktop/mobile screens and checks normal interaction flows; this agent does not claim browser QA.

## D01 — Static, independent implementation

- Context: the user approved implementing all six proposed services and adding them to WEB LAB.
- Options: merge into existing services; backend/Sites hosting; independent static Pages repositories.
- Decision: independent route-race repository and public GitHub Pages, pure model separated from rendering, no dependencies or new paid services.
- Rationale: fits the current collection, keeps other releases untouched, supports local model verification.
- Affected: architecture.md, dist, test, tools and .github/workflows/pages.yml.
- Review: additions requiring server state or different hosting need a separate decision.

## D02 — Transient, bounded browser state

- Context: these experiments need configuration, not user accounts or retained visitor records.
- Options: server upload/analytics/history; transient browser memory and deliberate local output.
- Decision: no stored visitor state or uploaded data. Bound all controls and model work. Pixel imports, when applicable, never leave the browser; reject unsupported/oversized files and cap decoded work.
- Rationale: privacy and predictable resource use; no API credential or personal profile required.
- Affected: dist/src/model.js, dist/src/app.js, dist/index.html and optional WebMCP summaries.
- Review: do not add hidden persistence or make medical/real-traffic/benchmark claims from these models. Use GitHub noreply identity for commits.

## D03 — 계산과 조작의 경계

- Context: 설명만 표시하는 데 그치지 않고 조작한 조건에서 실제 결과를 계산해야 합니다.
- Options: 고정 애니메이션/결과 문구; 범위를 제한한 순수 모델과 동일 상태를 읽는 UI.
- Decision: 상하좌우 이동, 진입 비용 1 또는 5, 출발 칸 비용 제외입니다. A*는 맨해튼 거리의 허용 가능한 추정값을 사용합니다. 재생은 방문 기록을 보여주는 것이며 실행 속도 벤치마크가 아닙니다. 지도 변경 시 이전 결과를 폐기합니다.
- Rationale: 재현 가능한 검사와 읽을 수 있는 결과를 제공하고 브라우저 자원 사용을 제한합니다.
- Affected: dist/src/model.js, dist/src/app.js, dist/index.html, dist/styles.css and test/model.test.js.
- Review: 큰 지도를 위한 우선순위 큐 최적화는 이번 크기에서 필요하지 않습니다. 지도 확대 시 성능과 동률 처리 규칙을 재검토합니다.

## D04 — Reachable RR1 challenges and fresh attempts / 2026-10-09

- Context: consecutive LCG seeds produced similar layouts, and arbitrary random walls could prevent meaningful comparison.
- Options: retry until a solver succeeds; fixed templates with increasing labels; constructive seeded maps with a versioned replay code.
- Decision: five families (cost trap, DFS maze, staggered bottlenecks, distance lure, mixed terrain), constructive connectivity, deterministic uint32 PRNG in the pure model and RR1-family-seed codes. UI-only crypto picks each fresh attempt; a collision with the previous seed is changed by XOR. Distinct seeds can legitimately yield the same finite layout. RR1 reproduces only the original map; edits and w are explicitly separate.
- Rationale: reproducible rules, broad structural variety and bounded generation without hidden retries or invented difficulty numbers.
- Affected: dist/src/model.js, dist/src/app.js, dist/index.html, test/oracle.test.js, README.md, architecture.md.
- Follow-up review: change the version if generation rules change; retain old rules if old codes must remain compatible. Reachability does not apply after editing.

## D05 — Preserve optimal searches; isolate heuristic tradeoffs / 2026-10-09

- Context: users need to explore heuristic tradeoffs without silently changing orthodox A*.
- Options: change base A*'s heuristic; greedy search; a separate Weighted A* lane with reopening and a proved ratio; a bounded closed-once Weighted A* lane with no ratio claim.
- Decision: preserve BFS minimum steps and Dijkstra/A* minimum cost. Add Weighted A* with w={1,1.5,2,3,4}, unique open entries, no closed-cell reopening, discovery-order ties, and termination when E is popped. Only w=1 guarantees minimum cost. w>1 explicitly promises neither optimal cost nor fewer expansions; no approximation ratio is claimed.
- Rationale: honest comparison, deterministic traces and at most V expansions per strategy. Independent Bellman-Ford tests verify orthodox guarantees and weighted counterexamples rather than treating Dijkstra/A* agreement as an oracle.
- Affected: dist/src/model.js, dist/src/app.js, dist/index.html, test/oracle.test.js, architecture.md, README.md.
- Follow-up review: any reopening, queue optimization, heuristic or movement change needs renewed proof, trace semantics and oracle checks.

## D06 — Evidence-based missions and bounded traces / 2026-10-09

- Context: animation alone does not explain strategic choices or offer a measurable learning goal.
- Options: arbitrary level scores; prewritten winning answers; actual prediction comparisons plus constrained map design.
- Decision: predictions lock at computation, and answers derive from actual costs or expansions. Build mission starts blank, holds S/E fixed, permits 1-8 net changed cells and requires BFS cost minus Dijkstra cost >=8. A gap of 8 represents two net extra rough-terrain penalties (5-1); it is a concrete cost goal, not a difficulty rating. Failure/no path receives specific feedback. Frontier indices, extracted g/h/priority, five next candidates and each relaxation are shown per step. BFS g explicitly means steps, not terrain cost.
- Rationale: meaningful and inspectable goals; outcomes need not match a canned answer. Each trace is capped by V steps, V frontier indices, five scored candidates and four updates. Sampling five candidates is disclosed; the full frontier remains visible as outlines.
- Affected: dist/src/model.js, dist/src/app.js, dist/index.html, dist/styles.css, test/oracle.test.js, README.md.
- Follow-up review: learning outcomes are not validated by these tests; no ranking, measured speed or user ability claim. Additional missions must have explicit satisfiable rules.

## D07 — Transient undo and lifecycle / 2026-10-09

- Context: experimental editing needs recovery and keyboard/touch operation without retaining visitor history.
- Options: browser persistence/exported state; unlimited undo; a bounded transient undo stack.
- Decision: at most 32 changed-cell board snapshots in memory, reset on map replacement. No storage, cookies, backend, tracking or new requests. Map/weight edits invalidate predictions and results. Outside-canvas drag points are ignored. Animation frames run only during playback, pause on hidden page, cancel on exit; reduced-motion starts paused. Optional WebMCP uses the same paint/solve actions and rejects missing paint mode.
- Rationale: recovery within the static architecture and finite browser work; no data-retention or access-control expansion.
- Affected: dist/src/app.js, dist/src/ui.js, dist/index.html, dist/styles.css, architecture.md.
- Follow-up review: gesture-wide undo and saving edited maps are deferred. Any persistence or network access needs a separate explicit decision and authorization.
