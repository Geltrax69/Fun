# MASTER PROMPT — Open-World Third-Person City (Low Poly Bricks + Fantasy Characters)

> Paste everything below the line into a fresh Claude Code session opened in this repo.

---

You are building an **open-world, third-person, free-roam city game** in this repo
(`https://github.com/Geltrax69/Fun.git`, branch `main`). The core goal: **the player walks freely
around a living low-poly city full of NPCs.** No combat, no quests yet — roaming comes first.

## 0. Stack (decided — do not re-litigate)

- **Three.js + Vite + plain JavaScript** (no TS, no React, no physics engine at first).
- Why: assets are already glTF, it runs in a browser so you can **test every feature yourself
  in the built-in browser** (screenshots, console errors, FPS) in seconds — no Unity rebuild loop.
- Libraries allowed: `three` (incl. `three/addons`: GLTFLoader, SkeletonUtils, BufferGeometryUtils,
  stats). Add anything else only if a few lines can't do it.
- Blender is installed at `/Applications/Blender.app` — use it **headless** for asset conversion only:
  `/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/<script>.py`

## 1. The assets (what exists, and the gotchas)

### A. `Low_Poly_Bricks_city/` — environment
- `Models.zip` → 28 `.dae` (Collada, 2017) models:
  - **Buildings:** `House-1-1..1-5`, `House-2-1`, `House-2-2`, `Church`, `Lighthouse`
  - **Street props:** `Lamppost`, `Bench`, `Chair`, `Table`, `Parasol`, `Fence`, `FenceEnd`
  - **Nature:** `Birchtree`, `Foliage`, `Foliage2`, `Foliage3`, `ShoreRock`
  - **Waterfront kit:** `RiverWall`, `RiverWallCorner`, `RiverWallOpen`, `RiverWallStairs`,
    `RiverLand`, `RiverBridge`, `Ship`
- `Textures.zip` → tiny **palette textures** (`Houses Colorscheme*.png`, `TreesColorscheme.png`,
  `Ship Colorscheme.png`) + ground textures (`GroundTiles*`, `GroundDirt*`, `GroundGrass/Sand`,
  `Grass*`, `Foliage*` color+normal).
- `Low Poly Brick Houses.blend` — the source scene; open it to see the intended look/scale.

**Gotchas / how to use efficiently**
1. Three.js handles `.dae` poorly → **convert all 28 to `.glb` once** with a Blender headless script
   (`tools/convert_city.py`): import each `.dae`, apply transforms, fix scale so a door ≈ 2 m tall,
   origin at bottom-center, export `.glb` to `public/assets/city/`. Commit the `.glb`s, not the zips' contents.
2. Houses use **palette (colorscheme) textures** → many houses share one tiny texture. Swap the
   colorscheme per instance (Colorscheme 1–6) to get **6× visual variety for free** from 7 house meshes.
3. Repeated objects (lampposts, benches, fences, trees, foliage, river walls) → **`InstancedMesh`**,
   one draw call per type. Static buildings sharing a material → merge per city block with
   `BufferGeometryUtils.mergeGeometries`.
4. The river kit is modular — build a **canal with a bridge** through the city; `Ship` + `Lighthouse`
   + `ShoreRock` make a harbour edge. That's your city border (no invisible walls needed).

### B. `characters/Modular Character Outfits - Fantasy[Standard]/` — NPCs & player
- Use **`Exports/glTF (Godot-Unreal)/`** (ignore `FBX (Unity)`).
  - `Outfits/` — 4 full outfits: `Male_Peasant`, `Female_Peasant`, `Male_Ranger`, `Female_Ranger`.
  - `Modular Parts/` — same outfits split into `Body / Arms / Legs / Feet / Head_Hood / Acc_Pauldron(s)`.
  - Textures: `T_Peasant_*`, `T_Peasant_2_BaseColor` (alt colour), `T_Ranger_*`, `T_Ranger_3_BaseColor`
    (alt colour), `T_Regular_Male/Female_Dark_BaseColor` (skin).
- All outfits share **one 65-joint skeleton**.

**Gotchas — these two block NPCs, solve first:**
1. **No heads/faces.** The Readme says these outfits pair with Quaternius' *Universal Base Characters*
   (https://quaternius.com/packs/universalbasecharacters.html, free, CC0). Only the **head** of the base
   character is needed (body would clip). → Ask the user to download it into `characters/UniversalBase/`
   if missing. Fallback until then: rangers already have hoods; for peasants attach a simple head mesh.
2. **No animations (0 clips).** Need *Universal Animation Library* from Quaternius (same skeleton,
   CC0: idle, walk, run, sit, talk, wave…). → Ask the user to download into `characters/Animations/`.
   Load clips once and play them on every character via `AnimationMixer` (same rig = retarget-free).

**Variety recipe (cheap):** mix-and-match modular parts + swap BaseColor (`T_Peasant` vs `_2`,
`T_Ranger` vs `_3`) + skin tone + male/female → **dozens of distinct NPCs from 4 outfits**.
Build them with a `makeCharacter({sex, body, legs, feet, head, palette})` that clones the shared skeleton
via `SkeletonUtils.clone` and binds parts to it.

## 2. Features — build in this order, one at a time

Each feature = **build → test in browser → fix → commit → push**. Never start the next before the
current one runs with **zero console errors** and **≥ 60 FPS** on this Mac.

| # | Feature | Done when |
|---|---------|-----------|
| 1 | Vite + Three.js skeleton, ground plane, sky/fog, sun light + shadows, stats overlay | Page loads, FPS visible |
| 2 | Asset pipeline: `tools/convert_city.py` → 28 `.glb`; tiny asset viewer page | All 28 render at correct scale |
| 3 | City generator: grid of streets + blocks from data (`src/city/layout.js`, seeded random), houses w/ random colorscheme, lampposts/benches/trees along streets, canal + bridge, harbour edge | A walkable town ~300×300 m |
| 4 | Player: Ranger outfit, WASD + Shift run, Space jump, **third-person orbit camera** (mouse, pointer-lock, scroll zoom, camera doesn't clip through walls via raycast) | Smooth roaming |
| 5 | Collisions: simple — box colliders from building bounds + capsule vs AABB, ground height | Can't walk through houses |
| 6 | Animations on player: idle / walk / run blend by speed | Feet don't slide |
| 7 | NPCs: spawn 30–60 randomized characters; navigation via a **waypoint graph of sidewalks** (not a navmesh lib) | NPCs walk the streets |
| 8 | NPC behaviours (tiny state machine): `wander → sit (bench/chair) → stand → chat (2 NPCs face each other, talk anim) → wander`; look at player when near | City feels alive |
| 9 | Player interaction: press **E** near NPC → they stop, face you, wave, show a speech bubble line | Interaction works |
| 10 | Polish: day/night cycle (lamppost lights on at night), footstep/ambient audio, minimap | — |

## 3. Performance rules (apply from feature 1)

- `InstancedMesh` for every repeated prop; merge static buildings per block; share materials.
- One `GLTFLoader` cache — load each `.glb` **once**, clone instances.
- NPC LOD: beyond 40 m → update animation mixer every 3rd frame; beyond 80 m → hide.
- Shadows: one directional light, shadow camera follows player, `shadowMap` 2048 max.
- Cap `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`.
- Keep draw calls < 300 (check `renderer.info`).
- Textures: keep palette PNGs tiny, set `NearestFilter`-free defaults, `colorSpace = SRGBColorSpace` on base colours.

## 4. Testing loop (fast, catches errors early)

After every feature:
1. `npm run dev` via `.claude/launch.json` → open in the built-in browser.
2. Read console errors (must be 0) and take a screenshot.
3. Check FPS + `renderer.info.render.calls` in the overlay.
4. For logic with branches (layout generator, collision, NPC state machine) leave **one** tiny
   `node --test` file — no frameworks.
5. Fix, re-check, then commit.

## 5. Git

- Commit + **push to `origin main` after each feature** (message: `feat(N): <feature>`).
- `.gitignore`: `node_modules/`, `dist/`, `.DS_Store`, `.remember/`.
- Big binaries are already pushed — if a push times out (HTTP 408), push in smaller commits.

## 6. Folder layout

```
index.html
src/
  main.js            # renderer, loop
  assets.js          # loader + cache
  city/layout.js     # street grid + placement
  player.js          # controller + camera
  npc/npc.js         # character factory, behaviour state machine
  npc/waypoints.js
public/assets/city/  # converted .glb
public/assets/chars/ # gltf outfits, heads, animations
tools/convert_city.py
```

## 7. Start now

Start with features 1–2. Before feature 6/7, check whether `characters/UniversalBase/` and
`characters/Animations/` exist; if not, stop and ask the user to download the two free Quaternius
packs (links above). Report after each feature with: screenshot, FPS, draw calls, commit hash.
