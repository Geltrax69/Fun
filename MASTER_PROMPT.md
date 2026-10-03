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

- The outfits have **no heads and no animations**. Both come from the two packs below
  (Quaternius, CC0). **All three packs use the identical 65-bone skeleton** (verified, same bone names)
  → no retargeting needed.

### C. `characters/UniversalBase/` — heads, faces, hair (Universal Base Characters, free version)
- Use `Base Characters/Godot - UE/`:
  - `Superhero_Male_FullBody.gltf` (meshes: `Face`, `Face.001`, body) and
    `Superhero_Female_FullBody.gltf` (meshes: `Eyebrows`, `Eyes`, `Superhero_Female`).
  - Skin: `T_Superhero_Male_Dark.png`, `T_Superhero_Female_Dark_BaseColor.png` (+ `_Normal`, `_Roughness`);
    eyes: `T_Eye_Brown.png`.
- Hair: `Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/` → `Hair_Beard`, `Hair_Buns`, `Hair_Buzzed`,
  `Hair_BuzzedFemale`, `Hair_Long`, `Hair_SimpleParted`, `Eyebrows_Female`, `Eyebrows_Regular`
  (textures `T_Hair_1/2_*`). Already skinned to the head bone → just bind to the character skeleton.
- Ignore: `Unity/`, `FBX` folders, `Hairstyles/Origin at 0/`, the duplicate `*_png.png` files.

**Gotchas:**
1. Free version ships only **Superhero** proportions; the outfits are **Regular** proportions. Only the
   head is used, so: in Blender headless (`tools/extract_heads.py`) **delete every vertex not weighted to
   `neck`/`Head` bones** → export `Head_Male.glb` / `Head_Female.glb`. Body would clip (Readme says so).
2. Bind the head to the **outfit's** skeleton (outfit is the master rig). Verify the neck seam lines up;
   if the head floats/sinks, adjust the head mesh offset or scale ~0.95 in the extract script — check
   with a screenshot, don't guess.
3. Rangers wear `Head_Hood` → skip hair for them (it clips through the hood).

### D. `characters/Animations/` — Universal Animation Library (43 clips)
- Use `Unreal-Godot/UAL1_Standard.glb` (in-place; the game moves the character).
  `UAL1_Standard_RM.glb` = root-motion version — don't use. Ignore `Unity/`.
- Load the `.glb` once, take `gltf.animations`, play them on any character with its own `AnimationMixer`.
  Drop the `Mannequin` mesh.
- Clips mapped to game needs:

| Need | Clip |
|------|------|
| Idle | `Idle_Loop` |
| Walk (NPC) / walk (player) | `Walk_Loop`, `Walk_Formal_Loop` (variety) |
| Jog / Run | `Jog_Fwd_Loop`, `Sprint_Loop` |
| Jump | `Jump_Start` → `Jump_Loop` → `Jump_Land` |
| Sit on bench/chair | `Sitting_Enter` → `Sitting_Idle_Loop` / `Sitting_Talking_Loop` → `Sitting_Exit` |
| Chat with NPC / player | `Idle_Talking_Loop` |
| Interact (E key) | `Interact` |
| Ambient life | `Dance_Loop`, `Fixing_Kneeling`, `PickUp_Table`, `Idle_Torch_Loop` (night), `Push_Loop` |
| Water (canal) | `Swim_Idle_Loop`, `Swim_Fwd_Loop` |
| Crouch | `Crouch_Idle_Loop`, `Crouch_Fwd_Loop` |

  Combat clips (Sword/Pistol/Punch/Spell/Hit/Death) — ignore for now (no combat).

**Variety recipe (cheap):** mix-and-match modular parts + swap BaseColor (`T_Peasant` vs `_2`,
`T_Ranger` vs `_3`) + male/female + 6 hairstyles + beard/no beard + walk style (`Walk_Loop` vs
`Walk_Formal_Loop`) → **hundreds of distinct NPCs from 4 outfits**.
Build them with `makeCharacter({sex, outfit, palette, hair, beard})`: clone the outfit with
`SkeletonUtils.clone`, then bind head + hair meshes to that same skeleton (`mesh.bind(skeleton)`).
Cache one template per (sex, outfit); clone per NPC.

## 2. Features — build in this order, one at a time

Each feature = **build → test in browser → fix → commit → push**. Never start the next before the
current one runs with **zero console errors** and **≥ 60 FPS** on this Mac.

| # | Feature | Done when |
|---|---------|-----------|
| 1 | Vite + Three.js skeleton, ground plane, sky/fog, sun light + shadows, stats overlay | Page loads, FPS visible |
| 2 | Asset pipeline: `tools/convert_city.py` → 28 `.glb`; tiny asset viewer page | All 28 render at correct scale |
| 3 | City generator: grid of streets + blocks from data (`src/city/layout.js`, seeded random), houses w/ random colorscheme, lampposts/benches/trees along streets, canal + bridge, harbour edge | A walkable town ~300×300 m |
| 4 | Character pipeline: `tools/extract_heads.py` → `Head_Male/Female.glb`; `makeCharacter()`; character viewer page showing 8 random NPCs playing `Idle_Loop` | Heads sit on necks, no clipping |
| 5 | Player: Ranger outfit, WASD + Shift run, Space jump, **third-person orbit camera** (mouse, pointer-lock, scroll zoom, camera doesn't clip through walls via raycast) | Smooth roaming |
| 6 | Collisions: simple — box colliders from building bounds + capsule vs AABB, ground height | Can't walk through houses |
| 7 | Player animations: `Idle_Loop` / `Walk_Loop` / `Jog_Fwd_Loop` / `Sprint_Loop` cross-faded by speed, jump trio | Feet don't slide |
| 8 | NPCs: spawn 30–60 randomized characters; navigation via a **waypoint graph of sidewalks** (not a navmesh lib) | NPCs walk the streets |
| 9 | NPC behaviours (tiny state machine): `wander → sit (bench/chair: Sitting_Enter/Idle/Exit) → chat (2 NPCs face each other, Idle_Talking_Loop / Sitting_Talking_Loop) → ambient (Dance, Fixing_Kneeling) → wander`; turn head toward player when near | City feels alive |
| 10 | Player interaction: press **E** near NPC → player plays `Interact`, NPC stops, faces you, `Idle_Talking_Loop` + speech bubble | Interaction works |
| 11 | Polish: day/night cycle (lamppost lights on at night, some NPCs carry `Idle_Torch_Loop`), swimming in canal, footstep/ambient audio, minimap | — |

## 3. Performance rules (apply from feature 1)

- `InstancedMesh` for every repeated prop; merge static buildings per block; share materials.
- One `GLTFLoader` cache — load each `.glb` **once**, clone instances.
- Load `UAL1_Standard.glb` once (7.6 MB) and share its clips; never load it per NPC.
- Drop the 4K hair/skin normal maps to 1K at copy time (they're 4–5 MB each) — low-poly doesn't need them.
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
public/assets/chars/ # outfits .gltf, Head_*.glb, hair .gltf, UAL1_Standard.glb
tools/convert_city.py
tools/extract_heads.py
```

## 7. Start now

Start with features 1–2. All assets are already in the repo (city, outfits, heads/hair, animations) —
nothing to download. Copy only the files listed above into `public/assets/` (never the Unity/FBX ones). Report after each feature with: screenshot, FPS, draw calls, commit hash.
