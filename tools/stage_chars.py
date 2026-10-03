#!/usr/bin/env python3
"""Stage character/animation assets into public/assets/chars/.

Copies only what the game needs (never the Unity/FBX folders):
  characters/Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/
      -> public/assets/chars/outfits/      (Outfits + Modular Parts, .gltf/.bin/textures)
  characters/UniversalBase/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/
      -> public/assets/chars/hair/         (hair .gltf/.bin + textures)
  characters/Animations/Unreal-Godot/UAL1_Standard.glb
      -> public/assets/chars/animations/UAL1_Standard.glb
  Low_Poly_Bricks_city/Textures.zip contents (unzipped in tools/_work/textures)
      -> public/assets/city/textures/

4K normal maps are downscaled to 1K at copy time (low-poly doesn't need them).
Head extraction (tools/extract_heads.py, needs Blender) writes directly into
public/assets/chars/heads/ and handles its own texture copies.

Usage: python3 tools/stage_chars.py
"""
import os
import shutil
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CH = os.path.join(REPO, "characters")
PUB = os.path.join(REPO, "public", "assets", "chars")
WORK_TEX = os.path.join(REPO, "tools", "_work", "textures")

MAX_NORMAL = 1024


def copy_tree(src, dst):
    if os.path.exists(dst):
        shutil.rmtree(dst)
    shutil.copytree(src, dst)
    print(f"copied {src} -> {dst}")


def downscale_normals(root):
    """Downscale any >1K *Normal*.png under root to 1K max dimension."""
    for dirpath, _, files in os.walk(root):
        for f in files:
            if "Normal" in f and f.endswith(".png"):
                p = os.path.join(dirpath, f)
                im = Image.open(p)
                if max(im.size) > MAX_NORMAL:
                    im = im.resize(
                        (MAX_NORMAL, int(im.size[1] * MAX_NORMAL / im.size[0])),
                        Image.LANCZOS,
                    )
                    im.save(p)
                    print(f"downscaled {os.path.relpath(p, REPO)} -> {im.size}")


def main():
    outfits_src = os.path.join(
        CH, "Modular Character Outfits - Fantasy[Standard]",
        "Exports", "glTF (Godot-Unreal)")
    assert os.path.isdir(outfits_src), f"missing {outfits_src}"
    copy_tree(outfits_src, os.path.join(PUB, "outfits"))

    hair_src = os.path.join(
        CH, "UniversalBase", "Hairstyles", "Rigged to Head Bone",
        "glTF (Godot -Unreal)")
    assert os.path.isdir(hair_src), f"missing {hair_src}"
    copy_tree(hair_src, os.path.join(PUB, "hair"))

    anim_src = os.path.join(CH, "Animations", "Unreal-Godot", "UAL1_Standard.glb")
    assert os.path.isfile(anim_src), f"missing {anim_src}"
    anim_dst = os.path.join(PUB, "animations")
    os.makedirs(anim_dst, exist_ok=True)
    shutil.copy2(anim_src, os.path.join(anim_dst, "UAL1_Standard.glb"))
    print(f"copied {anim_src} -> {anim_dst}/")

    city_tex_dst = os.path.join(REPO, "public", "assets", "city", "textures")
    assert os.path.isdir(WORK_TEX), f"missing {WORK_TEX} (unzip Textures.zip first)"
    copy_tree(WORK_TEX, city_tex_dst)

    downscale_normals(PUB)

    total = sum(
        os.path.getsize(os.path.join(dp, f))
        for dp, _, fs in os.walk(PUB) for f in fs
    )
    print(f"staged public/assets/chars: {total / 1024 / 1024:.1f} MB total")


if __name__ == "__main__":
    main()
