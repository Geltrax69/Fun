# PHASE 3 PROMPT — Real NPC Paths, Real Conversations, Real Weather

> Paste everything below the line into a fresh Claude Code session opened in this repo.
> Supersedes the order in `PHASE2_PROMPT.md`; do its Feature 0 fixes as part of step 1 below.

---

You are continuing an **open-world, third-person, free-roam city game** in this repo
(`https://github.com/Geltrax69/Fun.git`, branch `main`). Stack is fixed: **Three.js + Vite + plain JS**.
`git pull`, then read `README.md`, `MASTER_PROMPT.md`, `PHASE2_PROMPT.md`.

The player's complaints this phase fixes, in their words:
1. **"NPCs have no paths"** — they drift randomly with no visible paths or destinations.
2. **"Conversations are random, not interactive"** — E shows one random line and ends. It must be a
   real back-and-forth: *NPC speaks → I reply → NPC answers → … until someone says goodbye.*
3. **"Weather isn't realistic."**
4. **"Use free assets"** — six free CC0 packs are now in `assets_free/` (below). Use them.

## 0. New free assets (all CC0, Kenney, already in the repo)

Copy only what you use into `public/assets/free/…`. Kenney models are flat-shaded, colour-atlas
textured (`Models/Textures/colormap.png`), roughly **1 unit = 1 m** but check scale against the
1.8 m characters with a screenshot. Load each `.glb` once, clone/instance.

| Folder | What's useful | Use it for |
|---|---|---|
| `assets_free/watercraft-pack/Models/GLB format/` | `boat-row-small`, `boat-row-large`, `boat-fishing-small`, `boat-sail-a/b`, `boat-tug-a`, `ship-small`, `ship-large`, `buoy`, `buoy-flag`, `cargo-container-*`, `cargo-pile-*` | Canal rowboats, harbour traffic, buoys, cargo on the quay |
| `assets_free/pirate-kit/Models/GLB format/` | `structure-platform-dock(-small)`, `platform-planks`, `barrel`, `crate`, `crate-bottles`, `chest`, `flag*`, `mast-ropes`, `tool-paddle`, `rocks-*` | Wooden jetties on the harbour + canal, dock clutter, market crates |
| `assets_free/food-kit/Models/GLB format/` | `bread`, `croissant`, `cheese`, `apple`, `fish`, `carrot`, `cabbage`, `barrel`, `cup-coffee`, `cup-tea`, `glass-wine`, `bowl-*` (201 models) | Market stalls, café tables, fishmonger at the harbour |
| `assets_free/nature-kit/Models/GLTF format/` (`.glb` inside) | `flower_*`, `plant_bush*`, `grass*`, `rock_*`, `tree_*`, `log*`, `bridge_*` (329) | Flower boxes, park beds, bushes along sidewalks, variety in parks |
| `assets_free/particle-pack/PNG (Transparent)/` | `smoke_01..10`, `circle_01..05`, `light_*`, `spark_*`, `trace_*`, `dirt_*`, `twirl_*` | Rain streaks (`trace_*`), splashes (`circle_*`), chimney/fog wisps (`smoke_*`), lamp glow (`light_*`) |
| `assets_free/rpg-audio/Audio/` (`.ogg`) | `footstep00..09`, `doorOpen_*`/`doorClose_*`, `handleCoins*`, `creak*`, `cloth*`, `bookFlip*` | Real footsteps (replace procedural ones), doors when NPCs go home, coins at the market, creaking boats |

Need more? Allowed sources — **CC0 only**, download with `curl` from the official site, record each in
`assets_free/CREDITS.md`:
- Kenney (`https://kenney.nl/assets/<name>` → the zip link on the page; direct download works).
- Poly Haven (`https://polyhaven.com`) — HDRI skies (e.g. `kloofendal_48d_partly_cloudy_puresky`,
  overcast, sunset) via `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/<id>_1k.hdr`.
- ambientCG (`https://ambientcg.com`) — tiling textures (cobblestone, wet asphalt, puddles).
- Quaternius (itch.io) blocks scripted downloads → if one is needed, **ask the user** to download it.
Ask the user before any download over 50 MB.

## 1. NPC paths — make movement purposeful and visible

| # | Task | Done when |
|---|---|---|
| 1a | **Visible paths:** raised 0.15 m sidewalks along every street (ambientCG cobblestone or `GroundTiles` from the city pack), paved bridge approaches, dirt paths (`GroundDirt`) through parks, cobbled plaza. The waypoint graph (`src/npc/graph.js`) must sit **exactly on these sidewalks**. | Screenshot: every NPC is on a sidewalk/path, none on grass/road |
| 1b | **Destinations, not random walks:** named places (`market`, `cafe`, `church`, `harbour`, `park-NW`…, `home-<id>`). Each NPC picks a destination and walks there with **A\*** over the graph (~30 lines, + `node --test`). Arrive → do the place's activity → pick next. | `__crowd` shows every NPC with a `dest` and a path |
| 1c | **Daily schedule** per NPC (role-based): morning → work, noon → café/market, evening → canal walk/plaza, night → home (walk to their door, `doorOpen` sound, fade out; reappear at dawn). | Fast-forwarding time shows the crowd shift between places |
| 1d | **Crossings & bridges:** zebra crossings at intersections; NPCs only cross streets there; they use the 3 bridges to change canal side. | No NPC jaywalks |
| 1e | **Local avoidance:** NPCs steer around each other, the player, benches, lampposts (simple separation force), keep to the right side of the sidewalk; groups of 2–3 friends walk together. | No NPCs walking through each other |
| 1f | Debug overlay (`P` key): draw the graph and each NPC's current path. | Paths visible on demand |

## 2. Real conversations — a turn-based dialogue system

**Goal:** talking is a back-and-forth that continues until someone ends it.

| # | Task | Done when |
|---|---|---|
| 2a | **Dialogue UI:** E near an NPC → camera eases to an over-the-shoulder shot, both face each other, NPC plays `Idle_Talking_Loop`. Bottom panel: NPC name + role, their line typed out, then **2–4 numbered reply choices** (keys 1–4 or click) + "Goodbye". Movement is locked while talking; Esc/Goodbye ends it. | Can hold a 5+ turn conversation |
| 2b | **Dialogue trees as data:** `src/dialogue/*.json` — nodes `{ id, npc: "text", replies: [{ text, next, effect? }] }`. Per-role trees (baker, sailor, guard, fisher, priest, musician, child, traveller) plus shared nodes (weather talk, directions, gossip, goodbye). Text may use variables: `{name}`, `{timeOfDay}`, `{weather}`, `{place}`, `{playerName}`. | 8 roles × ≥ 6 nodes each |
| 2c | **Memory:** each NPC remembers if you've met, your name (asked once on first meeting), what you talked about, and their mood toward you (+/−). Second meeting starts differently ("Back again, {playerName}!"). Persist in `localStorage` (wrap in try/catch). | Talking twice to the same NPC differs |
| 2d | **Context:** lines change with time of day, weather (rain → complaints, offers of shelter), location, and active errands. NPCs can **give directions** ("The market? Cross the middle bridge, then left") computed from the A* path, and drop a minimap marker. | Asking for directions marks the minimap |
| 2e | **Errands from dialogue:** some replies start a task (deliver bread from the baker to the sailor). Item shown in a HUD slot; coins (`handleCoins` sound) on completion. 5+ errands. | One errand completable end-to-end |
| 2f | **NPC↔NPC chats look real:** chatting pairs show short alternating speech bubbles (pulled from the same trees), with gestures, then part ways. | Bubbles alternate between both NPCs |
| 2g | **Optional — free-form AI chat** (only if the user wants it): a "Say something…" text box as a 5th option. Browser calls a tiny local Node proxy (`server/chat.mjs`, reads `ANTHROPIC_API_KEY` from env — **never** put the key in client code or the repo) that calls the Claude API (`claude-haiku-4-5-20251001` for speed) with the NPC's persona, memory, time, weather and place as the system prompt; reply ≤ 2 sentences. Falls back to the scripted tree if the proxy is offline. | Works with the proxy running; scripted mode unaffected without it |

## 3. Realistic weather

| # | Task | Done when |
|---|---|---|
| 3a | **Sky:** replace the flat colour with `three/addons/objects/Sky.js` (physical sky driven by the existing sun position) or Poly Haven HDRIs blended by time of day; `scene.environment` from it so materials get real reflections. | Sunrise/sunset look natural |
| 3b | **Clouds:** a high cloud layer (large plane/dome with scrolling noise shader or `smoke_*` sprite billboards), cloud cover 0–1 drives sun intensity and shadow softness. | Overcast days look grey and soft-shadowed |
| 3c | **Weather state machine:** `clear → cloudy → drizzle → rain → storm → clearing`, plus `fog` mornings. Smooth 30–60 s transitions; random but seeded by in-game day. `W` key cycles weather (debug). | All states reachable and blend smoothly |
| 3d | **Rain:** GPU instanced streaks (`trace_*` sprite) in a box that follows the camera (no per-drop JS), wind slant, splash sprites (`circle_*`) on the ground, rings on canal/sea water, drips off roofs optional. | 60 FPS in heavy rain |
| 3e | **Wet world:** during/after rain, ground/road roughness ↓ and colour darker, puddle mask (ambientCG puddle texture) reflecting lamps at night, dries over ~2 min. | Streets visibly wet, then dry |
| 3f | **Storm:** lightning (sky flash + brief directional light spike), thunder (delay by distance), stronger wind: trees sway more (vertex shader), boats rock harder, sea waves taller. | Storm feels dramatic |
| 3g | **Fog & mist:** morning fog density curve, mist over the canal (`smoke_*` low billboards). | Foggy dawn |
| 3h | **People react:** in rain NPCs walk faster, gather under parasols/doorways, fewer leave home; café empties in storms; after rain children play. Weather lines in dialogue (2d). | Crowd visibly changes with rain |
| 3i | **Audio:** rain loop volume by intensity, thunder, wind, gulls only in clear weather. | Audio matches weather |

## 4. Use the new assets in the city

| # | Task | Done when |
|---|---|---|
| 4a | **Boats** (PHASE2 F1): 3–4 `boat-row-small/large` drifting the canal and passing **under** the bridges with a seated rower (`Sitting_Idle_Loop`); `boat-sail-a/b`, `boat-fishing-small`, `boat-tug-a` on slow loops in the harbour; gentle bob + roll, more in storms; `buoy-flag` markers. | Boats move on canal + sea |
| 4b | **Docks:** `structure-platform-dock` jetties at the harbour and 2 small canal landings with `barrel`/`crate` clutter; fishermen NPCs there. | Walkable jetties |
| 4c | **Market square:** 6 stalls (city-pack `Table` + `Parasol`) with food-kit goods; vendors behind stalls; shoppers queue. | Market is a busy hotspot |
| 4d | **Café:** canal-side tables with `cup-coffee`/`cup-tea`/`croissant`; NPCs sit with `Sitting_Talking_Loop`. | Café has seated NPCs |
| 4e | **Greenery:** nature-kit flower boxes under windows, bushes along sidewalks, flower beds and rocks in parks — instanced. | Streets look tended |
| 4f | **Sound:** replace procedural footsteps with `footstep00..09` (random pick, surface-aware volume), doors, coins, boat creaks. | Footsteps sound real |

## 5. Order, rules, testing

**Order:** PHASE2 Feature 0 fixes (camera under water, sea edge, perf < 400 k tris, Mac-runnable
`tools/verify_*.mjs`) → 1a–1f → 2a–2f → 3a–3i → 4a–4f → 2g only if the user asks.

- One feature at a time: build → test → fix → **commit + push** (`feat(P3-1a): …`). Next only at
  **0 console errors** and **≥ 60 FPS** (check `renderer.info` triangles and draw calls).
- Keep it small: reuse `makeCharacter`, `playAnim`, colliders, the waypoint graph, `dayNight`.
  No new npm libraries unless a few lines can't do it.
- Every branchy module (A*, schedules, dialogue engine, weather state machine) gets one tiny
  `node --test` file.
- Testing: the browser pane may be hidden (pauses `requestAnimationFrame`) → step logic
  deterministically in-page (see `tools/verify_collisions.mjs`), screenshots for visuals. Hooks:
  `window.__player`, `__crowd`, `__graph`, `__colliders`, `__scene`, `__dayNight`, `__simT`.
- Push in small commits if a push times out (HTTP 408). Never commit `17*.zip`.
- Report after each feature: screenshot, FPS, draw calls, triangles, commit hash.
