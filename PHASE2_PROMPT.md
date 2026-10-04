# PHASE 2 PROMPT — Make the City Lively & Interactive

> Paste everything below the line into a fresh Claude Code session opened in this repo.
> Phase 1 (`MASTER_PROMPT.md`, features 1–11) is done. This is the next round.

---

You are continuing an **open-world, third-person, free-roam city game** in this repo
(`https://github.com/Geltrax69/Fun.git`, branch `main`). Stack is fixed: **Three.js + Vite + plain JS**.
Read `README.md` and `MASTER_PROMPT.md` first, then `git pull`.

**Goal of this phase:** the city should feel *alive* — people with reasons to move, things moving
on the water, places worth visiting, and more ways for the player to interact.

## 0. Current state (verified 2026-10-04)

- 300×300 m seeded town (`src/city/layout.js`), canal at x=0 with **3 bridges at z = −60, 0, 60**,
  harbour south of z=150 with lighthouse + one static `Ship`.
- 36 NPCs on a sidewalk waypoint graph (`src/npc/graph.js`); behaviours: wander / sit / chat / dance /
  greet / torch at night. E = talk (10 random generic lines in `src/npc/interact.js`).
- Day/night (10-min cycle), lamppost lights, swimming + climb-out, audio, minimap.
- Perf: 60 FPS idle, **~0.8–1.0 M triangles**, 80–180 draw calls.
- **Just fixed (commit `ce8e37e`):** canal/quay walls used to stand 4.2 m above the street and bury
  the bridges → walls now flush with the street (railing = fence), bridges walkable, NPC graph links
  across the bridges. `bridgeDeckAt()` in `src/city/colliders.js` gives deck height.

## 1. Known issues — fix these first (Feature 0)

| # | Issue | Fix | Done when |
|---|---|---|---|
| 0a | **No boats** — water is empty, the one `Ship` is static | See Feature 1 | Boats visible from every quay |
| 0b | Camera dips **below the water** while swimming → the world is seen from underneath (sky under the town) | Clamp camera y ≥ `WATER_Y + 0.4` in `src/player/player.js`; raycast-camera already exists, add the clamp after it | Swimming anywhere never shows the underside |
| 0c | Sea plane ends at z=350 → **void/sky at the horizon** | Make the sea a large plane (e.g. 4000×4000) centered on the player each frame, or a big circle; fog hides the edge | No visible edge from the lighthouse |
| 0d | Railing gap at each bridge is a full 10.9 m wall segment, wider than the 5.6 m bridge | Add 2 short `FenceEnd`/bollard props at each side of the bridge mouth (|z−bz| ≈ 3–5) with prop colliders | Gap matches bridge width |
| 0e | Can't swim under bridges (ground check reads deck height) | In `updateSwim`, ignore `bridgeDeckAt` when player y < deck − 1 | Swim the full canal |
| 0f | `tools/verify_*.mjs` hardcode Linux paths (`/home/hatch/...`, `chromium-linux64`) | Use `import { chromium } from 'playwright'` + default browser; add `playwright` as devDependency | `node tools/verify_player.mjs` runs on this Mac |
| 0g | Roads are flat dark grey, no sidewalks; city-pack ground textures unused (`GroundTiles*`, `GroundTilesBroken*`, `GroundDirt*`) | Raised 0.15 m sidewalks with `GroundTiles` along every street, `GroundTilesBroken` on the plaza, `GroundDirt` paths in parks | Streets read as streets |
| 0h | ~1 M triangles for a low-poly town | Merge houses per block, LOD: beyond 120 m swap Church/Lighthouse/Ship for simplified (decimated in Blender headless) versions; check `renderer.info` | < 400 k tris, ≥ 60 FPS while sprinting across town |

## 2. Features — build in this order, one at a time

Each feature = **build → test → fix → commit → push** (`feat(P2-N): …`). Next feature only when
**0 console errors** and **≥ 60 FPS**.

| # | Feature | Details | Done when |
|---|---|---|---|
| 1 | **Boats** | (a) 2–3 `Ship` instances sailing slow loops (≈2 m/s) on the sea, gentle bob + roll (`sin` on y / rotation.z). (b) Small rowboats in the canal: build a low-poly boat procedurally (a few boxes, wood colour from `Ship Colorscheme.png`) or a simple Blender-made `.glb`; 3–4 boats drifting up/down the canal, passing **under** the bridges, an NPC rower playing `Sitting_Idle_Loop`. (c) Boats are colliders while swimming. | Boats move on both canal and sea |
| 2 | **Living water** | Animated water: scroll a normal map / vertex-wave shader on canal + sea, foam strip along quay walls, ship wake (fading quad trail) | Water visibly moves |
| 3 | **More people, in the right places** | 80–120 NPCs. Spawn weighting: plaza, bridges, canal-side, harbour. Instanced/LOD'd: >60 m = skip mixer, >90 m = hide. Re-check FPS | Never < 5 NPCs on screen in town |
| 4 | **Daily schedules** | Each NPC gets `home`, `work` (market stall / harbour / church) and a schedule: morning → work, noon → café/plaza, evening → canal walk, night → go home (fade out at their door). Pathfind on the waypoint graph (A* over `graph.nodes`, ~30 lines) | Time-lapse shows the city change by hour |
| 5 | **Places to visit** | Market square: stalls from `Table` + `Parasol` + `Chair`; outdoor café by the canal (NPCs sit at tables with `Sitting_Talking_Loop`); harbour fishermen (`Fixing_Kneeling`); street musician (`Dance_Loop` crowd gathers around) | 4 distinct hotspots |
| 6 | **Better conversations** | Every NPC has a name + role (baker, sailor, guard…). Lines depend on role, time of day, and location; 2–3 reply choices (1/2/3 keys); NPCs remember they've met you ("Back again, traveler?") | Talking 3× to the same NPC gives different, fitting lines |
| 7 | **Small errands** | 5–8 simple fetch/deliver tasks ("bring this letter to the sailor at the harbour"): quest marker on minimap, item icon in HUD, reward = NPC thanks + coins counter | Can complete an errand end-to-end |
| 8 | **Player interactions** | Sit on any bench/chair (E near seat), wave (G → `Interact`), NPCs step aside / react when bumped or when you sprint past ("Hey!"), NPCs glance at you when near | Player can sit and wave |
| 9 | **Ambient life** | Gulls circling the harbour (instanced low-poly birds), pigeons on the plaza that scatter when you run, chimney smoke particles, trees swaying (vertex shader), church bell on each in-game hour, crowd murmur louder near people | World moves with no NPCs in view |
| 10 | **Weather & time** | Occasional rain (particles + darker sky + NPCs walk faster, fewer outside), clock HUD, `T` to fast-forward time | Rain cycle visible |
| 11 | **Fast travel & map** | `Tab` opens a full map (canvas, reuse minimap drawing) with named places; click a place = fast travel (fade out/in) | Can travel to harbour from map |

## 3. Rules (unchanged from phase 1)

- Lazy & small: reuse existing modules (`makeCharacter`, `playAnim`, colliders, waypoint graph).
  No new libraries unless a few lines can't do it.
- Performance from the start: `InstancedMesh` for repeats, share materials, load each `.glb` once.
- Every branchy piece of logic (schedules, A*, dialogue picking, errands) leaves one tiny
  `node --test` file next to it.
- **Testing:** the in-app browser pane may be hidden, which pauses `requestAnimationFrame`. Test logic
  by stepping deterministically in the page (`import('/src/player/player.js')` then call
  `updatePlayer(p, 1/60)` in a loop — see `tools/verify_collisions.mjs`), and take screenshots for
  visuals. Test hooks on `window`: `__player`, `__crowd`, `__graph`, `__colliders`, `__scene`,
  `__dayNight`, `__simT`.
- Commit + push after every feature. Big pushes time out (HTTP 408) → push in smaller commits.
- Never commit the `17*.zip` Unity packs in the repo root (they're in `.gitignore`; Unity-only and
  of unclear license).

## 4. Start now

Do Feature 0 (0a–0h) first, then Feature 1 (Boats). After each, report: screenshot, FPS, draw calls,
triangle count, commit hash.
