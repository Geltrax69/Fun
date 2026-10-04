# asset_packs — index

Web-ready copies of every asset pack. Everything here is **glTF / GLB** (FBX-only packs were converted
with `tools/fbx_to_glb.py` via headless Blender). Blender/OBJ/duplicate-FBX files were left out; the
original zips are in `_archives/` (git-ignored, local only).

All packs are by **Quaternius, CC0** unless noted. Checked 2026-10-04 by loading every file in
Three.js `GLTFLoader`: **1,495 models (this folder + `assets_free/`) load with 0 errors.**

FBX conversions were post-fixed with `tools/fix_converted_glb.py` (Blender exported 395 models with
alpha 0 → invisible; and clip names like `Armature|Armature|Walk` → `Walk`). Re-run both tools in
order if you convert more FBX.

## Compatibility test results (rendered in Three.js)

| Test | Result |
|---|---|
| Game outfits + **UAL2** clips (e.g. `Idle_Lantern_Loop`, `Idle_Torch_Loop`) | ✅ same rig, plays directly |
| **Bestiary Imp/Puglin** + UAL1/UAL2 clips | ✅ their 55 bones are a subset of the UAL rig → all 86 UAL clips work (no fingers/pinky) |
| Ultimate Modular Men/Women + own 24 clips (Walk, Wave, Idle_Gun_Pointing…) | ✅ |
| Ultimate Modular + UAL clips via `SkeletonUtils.retargetClip` | ❌ legs stretch/twist — not plug-and-play. Use their own clips, or retarget offline in Blender |
| Low Poly Men/Women + own clips (`Man_Walk`, `Female_Idle`, `Man_Sitting`…) | ✅ (scale ×0.37) |
| Animals (Animated + Farm) own clips (Idle, Eating, Walk, Gallop…) | ✅ |
| Prop in hand: torch → `hand_r` (game rig); pistol → `WristR` (Ultimate Modular rig) | ✅ attach as child of the bone; divide scale by the bone's world scale |
| Converted static models (buildings, furniture, survival, cars, ships, trees) | ✅ correct colours after the alpha fix |

**Bone-name gotcha:** Three.js strips dots from node names → `Wrist.R` is `WristR`, `UpperArm.L` is
`UpperArmL`. Hand bones: game rig `hand_r`/`hand_l`; Ultimate Modular `WristR`/`WristL`; Low Poly
`PalmR`/`PalmL`.

> **Scale differs per pack.** Always compare against a 1.8 m character with a screenshot. Measured
> sizes below; "×" is a suggested starting scale.

## characters/

| Pack | Contents | Rig / animations | Notes |
|---|---|---|---|
| `Quaternius_UltimateModularMen` | Adventurer, Beach, Casual_2, Casual_Hoodie, Farmer, King, Punk, Spacesuit, Suit, Swat, Worker (`Individual Characters/glTF/`) | own 62-bone rig, **24 clips each**: Idle, Idle_Neutral, Walk, Run, Run_Back/Left/Right, Wave, Interact, Roll, Punch/Kick, Sword/Gun, HitRecieve, Death | Modern townsfolk — fastest way to more NPC variety |
| `Quaternius_UltimateModularWomen` | Adventurer, Casual, Formal, Medieval, Punk, SciFi, Soldier, Suit, Witch, Worker | same 62-bone rig, 24 clips each | Pairs with the men pack |
| `Quaternius_LowPolyMen` / `LowPolyWomen` | Male_Casual/LongSleeve/Shirt/Suit, Female_Alternative/Casual/Dress/TankTop (+ `Smooth_` variants) | own 42-bone rig, 11 clips each: Idle, Walk, Run, Jump, Sitting, Standing, Clapping, Punch, SwordSlash, Death (prefixed `Man_`/`Female_`) | ~4.8 m tall → **×0.37** |
| `Quaternius_Bestiary_DungeonMonsters` | Imp, Puglin (+ 3 colour textures each) | 55-bone **subset of the UAL rig** → all UAL1/UAL2 clips work | Enemies, night creatures, dungeon |

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
| `Quaternius_Guns` | 6 guns with Fire/Reload/Slide clips; ~10 units long → **×0.03–0.05** to fit a hand |

## animals/

| Pack | Contents | Animations |
|---|---|---|
| `Quaternius_AnimatedAnimals` | Alpaca, Bull, Cow, Deer, Donkey, Fox, Horse, Horse_White, Husky, ShibaInu, Stag, Wolf | 13 each: Idle, Idle_2, Idle_Headlow, Eating, Walk, Gallop, Jump, Attack, HitReact, Death |
| `Quaternius_FarmAnimals` | Cow, Horse, Llama, Pig, Pug, Sheep, Zebra | Idle, Walk, WalkSlow, Run, Jump, Death — Cow ≈ 9 m → **×0.25** |
| `Quaternius_AnimatedFish` | Dolphin, Fish1–3, Manta ray, Shark, Whale | `Swim` clip each; ~8–16 m → **×0.1–0.3** |

City ideas: dogs (Husky, ShibaInu, Pug) walking with NPCs, horses + donkey at the market, pigeons
still need a source, fish/dolphins jumping in the harbour.

## vehicles/

| Pack | Contents | Size → scale |
|---|---|---|
| `Quaternius_Ships` | Boat, BoatWSail, Lifeboat, Sail ship, Viking boat, CruiseShip | Boat ≈ 0.7 m → **×6**; Sail ship ≈ 6.4 m → ×3 |
| `Quaternius_Cars` | Cop, NormalCar1/2, SUV, SportsCar/2, Taxi (wheels are separate meshes → can spin) | Taxi ≈ 4.2 m → **×1** (real scale) |

## Unity-only packs → `asset_packs_unity/` (local only, git-ignored)

Unpacked without Unity (`tools/unpack_unitypackage.py`), converted (`tools/fbx_to_glb.py`, NPC pack
with `APPLY=1`), fixed (`tools/fix_converted_glb.py`) and atlas-linked (`tools/link_atlas_textures.py`).
**1,679 models, all load in Three.js, all textured** (except 2 water planes, 1 pose file, and 18
Anime Tokyo signs/props that are plain-colour by design).
Anime Tokyo stores material links in prefabs, so it also needs `tools/link_unity_materials.py`
(reads the `.mat` files: albedo, normal, emission, colour, transparency; mapping built from prefabs,
saved as `_material_map.json`).
Source: opengameasset.net "VIP" re-uploads of paid Unity Asset Store packs → kept **out of the public
repo** on purpose. To rebuild on another machine, put the zips in `_archives/unity_only/` and rerun the
four tools in that order.

| Pack | Models | What it is | Status |
|---|---|---|---|
| `POLY_MegapolisCityPack` | 809 | Modern city: houses, cottages, apartment blocks, roads, airport, seaport, railway, farm, racing track, vehicles (ambulance, cars…), city props | ✅ real-world scale, one atlas `Polygon_Texture.png` |
| `ToonyTinyCityExtended` | 432 | **Modular** cartoon city kit: wall/window/door/balcony/rooftop pieces, burger shop, hospital, police, factory, park, parking, streets, cars, tram, lamps | ✅ real scale; must be assembled into buildings |
| `LowPolyVegetationKit` | 44 | Trees (pine etc.), plants, rocks, grass, water planes | ✅ ×0.6; leaves use alpha cut-out |
| `AnimeTokyo` | 357 | Japanese city (realistic-stylised): 39 buildings (apartment blocks 22–28 m, corner buildings, cylindrical towers…), 86 shop signs & LED billboards, 142 modular props (doors, AC units, antennas, vending…), 68 traffic assets (roads, curbs, highway), 13 metro assets, 4 vehicles, 5 nature | ✅ real scale; full PBR — albedo + **normal maps** + **emissive** signs + transparent glass. Heavier: up to 53 k tris/building |
| `LowPolyMedievalFantasy_NPCPack` | 37 | 16 medieval NPCs (M/F: King, Queen, Noble, Merchant, Cook, Blacksmith, Healer, Priest, Nun, Commoner) + base bodies + pre-posed static versions | ⚠️ see below |

**Medieval NPCs — how to use:**
- Each file contains **every** variant part at once (8 beards, 5 eyebrows/eyes/mouths, ~38 hair meshes).
  Show one per group: hide meshes matching `/^(facialHair_|[MF]_eyebrows|[MF]_eyes|[MF]_mouth|[MF]_hair_)/`
  except the chosen ones.
- Materials `genericRGBMat_Body` / `genericRGBMat_Objects` need a colour texture: set `map` to
  `Materials_Shaders_Textures/BodyPreColors/medievalTexture_bodyColor1..8.png` (body) and
  `ObjectPreColors/medievalTexture_objectColor1..16.png` (clothes/objects), `flipY = false`, sRGB.
  8 × 16 colour combos × parts = huge variety.
- Height ≈ 2.07 m incl. hair → **×0.87** to match 1.8 m characters.
- Own 99-bone rig (coat tails, cape, hair bones, `R_equip_joint`/`L_equip_joint` for props).
  **No walk/idle clips ship with the pack** → use as static/posed NPCs (`NPC_PrePosed/` = vendors,
  bystanders) until clips are retargeted in Blender.

## Not here

- `_archives/` — all original zips (git-ignored, local only).