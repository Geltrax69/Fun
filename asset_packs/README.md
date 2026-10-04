# asset_packs — index

Web-ready copies of every asset pack. Everything here is **glTF / GLB** (FBX-only packs were converted
with `tools/fbx_to_glb.py` via headless Blender). Blender/OBJ/duplicate-FBX files were left out; the
original zips are in `_archives/` (git-ignored, local only).

All packs are by **Quaternius, CC0** unless noted. Checked 2026-10-04: **833 models, 0 broken files,
0 missing textures/buffers.**

> **Scale differs per pack.** Always compare against a 1.8 m character with a screenshot. Measured
> sizes below; "×" is a suggested starting scale.

## characters/

| Pack | Contents | Rig / animations | Notes |
|---|---|---|---|
| `Quaternius_UltimateModularMen` | Adventurer, Beach, Casual_2, Casual_Hoodie, Farmer, King, Punk, Spacesuit, Suit, Swat, Worker (`Individual Characters/glTF/`) | own 62-bone rig, **24 clips each**: Idle, Idle_Neutral, Walk, Run, Run_Back/Left/Right, Wave, Interact, Roll, Punch/Kick, Sword/Gun, HitRecieve, Death | Modern townsfolk — fastest way to more NPC variety |
| `Quaternius_UltimateModularWomen` | Adventurer, Casual, Formal, Medieval, Punk, SciFi, Soldier, Suit, Witch, Worker | same 62-bone rig, 24 clips each | Pairs with the men pack |
| `Quaternius_LowPolyMen` / `LowPolyWomen` | Male_Casual/LongSleeve/Shirt/Suit, Female_Alternative/Casual/Dress/TankTop (+ `Smooth_` variants) | own rig, 11 clips each | Simpler/older style |
| `Quaternius_Bestiary_DungeonMonsters` | Imp, Puglin (+ 3 colour textures each) | 55-bone rig, no clips | Not for a city — keep for later |

**Rigs:** current game characters use the 65-bone Universal rig. The Ultimate Modular packs use a
**different 62-bone rig** → use their own built-in clips (don't mix with UAL clips without retargeting).

## animations/

| Pack | Contents |
|---|---|
| `Quaternius_UniversalAnimationLibrary2` | `Unreal-Godot/UAL2_Standard.glb` — **43 new clips on the same 65-bone rig as the current game** (works with existing outfits directly). City-useful: `Idle_FoldArms_Loop`, `Idle_TalkingPhone_Loop`, `Idle_Lantern_Loop`, `Idle_Rail_Loop` / `Idle_Rail_Call` (leaning on canal railing!), `Walk_Carry_Loop`, `Consume`, `Yes`, `Idle_No_Loop`, `Farm_Harvest/PlantSeed/Watering`, `TreeChopping_Loop`, `Chest_Open`, `ClimbUp_1m`, `LayToIdle`, `Slide_*`. `_RM` = root-motion version (don't use). `Female Mannequin/` = female base body. |

## city/

| Pack | Contents | Size → scale |
|---|---|---|
| `Quaternius_DowntownCityMegaKit` | 153 modular glTF pieces: brick walls, columns, trims, windows, doors, roofs, shopfronts (`Exports/glTF (Godot)/`), 36 textures | modular — check |
| `Quaternius_ModularBuildings` | 26 finished buildings + 18 base buildings + 32 modular parts. `Models with Materials/` = colours baked in; `Textured Models/` = palette-texture versions (9 colour PNGs in `Textures/` → swap per building for variety) | 2Story ≈ 2.75 m tall → **×3** |
| `free_city_pack` | 18 pieces: roads (straight/curved/intersection), building, block, bench, fire hydrant, garbage bin, street light, stop sign, traffic light/cone, red car, garden | unknown author/license — verify before shipping |

## nature/

| Pack | Contents | Size → scale |
|---|---|---|
| `Quaternius_StylizedNatureMegaKit` | 68 models: CommonTree_1–5, DeadTree, Pine, bushes (+ flowers), clover, grass, flowers, mushrooms, rocks, pebbles, paths (`glTF/`, 20 textures) | check |
| `Quaternius_UltimateNature` | 150 models: Birch / Pine / Willow / Common trees in normal, **Autumn, Snow, Dead** variants, rocks (moss), logs, bushes, plants, grass | Birch ≈ 3.6 m → **×2–3**. Snow/Autumn variants = seasonal weather! |

## props/

| Pack | Contents |
|---|---|
| `Quaternius_FantasyPropsMegaKit` | 94 models: market & tavern props — barrels (apples), crates, sacks, banners (+ cloth anim), anvil, benches, tables, chairs, beds, shelves, lanterns, candles, bottles, food, carts, signs |
| `Quaternius_Furniture` | 123 interior models: beds, couches, chairs, tables, kitchen, bathroom, doors, lamps, plants, rugs |
| `Quaternius_Survival` | 53 models: bonfire (+ fire), tent, torch, backpack, tools, cans, radio, traps |
| `Quaternius_Guns` | 6 guns (16 clips) — not needed for a peaceful city |

## animals/

| Pack | Contents | Animations |
|---|---|---|
| `Quaternius_AnimatedAnimals` | Alpaca, Bull, Cow, Deer, Donkey, Fox, Horse, Horse_White, Husky, ShibaInu, Stag, Wolf | 13 each: Idle, Idle_2, Idle_Headlow, Eating, Walk, Gallop, Jump, Attack, HitReact, Death |
| `Quaternius_FarmAnimals` | Cow, Horse, Llama, Pig, Pug, Sheep, Zebra | 26 clips total — Cow ≈ 9 m → **×0.25** |
| `Quaternius_AnimatedFish` | Dolphin, Fish1–3, Manta ray, Shark, Whale | 1 swim clip each — for the harbour/sea |

City ideas: dogs (Husky, ShibaInu, Pug) walking with NPCs, horses + donkey at the market, pigeons
still need a source, fish/dolphins jumping in the harbour.

## vehicles/

| Pack | Contents | Size → scale |
|---|---|---|
| `Quaternius_Ships` | Boat, BoatWSail, Lifeboat, Sail ship, Viking boat, CruiseShip | Boat ≈ 0.7 m → **×6**; Sail ship ≈ 6.4 m → ×3 |
| `Quaternius_Cars` | Cop, NormalCar1/2, SUV, SportsCar/2, Taxi (wheels are separate meshes → can spin) | Taxi ≈ 4.2 m → **×1** (real scale) |

## Not here

- `_archives/unity_only/` — 4 Unity `.unitypackage` files from opengameasset.net ("VIP" re-uploads of
  paid Asset Store packs: Megapolis City, Toony Tiny City, Medieval NPC Pack, Vegetation Kit).
  Unclear license, Unity-only → **not used, not committed.**
- `assets_free/` — Kenney CC0 packs (boats, docks, food, nature, particles, audio); see its `CREDITS.md`.
