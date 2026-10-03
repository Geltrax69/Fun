#!/usr/bin/env python3
"""Extract heads from the UniversalBase superhero bodies.

The outfits ship with no heads; the UniversalBase free pack only ships
Superhero proportions (body would clip), so we keep ONLY the head:
delete every vertex not weighted to the `neck`/`Head` bones.

Usage (headless):
    blender -b -P tools/extract_heads.py

Reads:  characters/UniversalBase/Base Characters/Godot - UE/Superhero_{Male,Female}_FullBody.gltf
Writes: public/assets/chars/heads/Head_{Male,Female}.glb
        (+ the head's textures copied next to it, normals downscaled to 1K)

The head keeps its skinning (vertex groups / bone names). At runtime the
game rebinds the head meshes to the outfit's skeleton (identical 65-bone
rig, remapped by bone name in code).
"""
import bpy
import os
import shutil
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(REPO, "characters", "UniversalBase", "Base Characters",
                       "Godot - UE")
DST_DIR = os.path.join(REPO, "public", "assets", "chars", "heads")
os.makedirs(DST_DIR, exist_ok=True)

KEEP_BONES = {"neck", "head"}  # matched case-insensitively
MAX_NORMAL = 1024


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images,
                 bpy.data.armatures, bpy.data.curves, bpy.data.actions):
        for x in list(coll):
            coll.remove(x)


def keep_vertex(obj, vert):
    """True if the vertex has weight on a keep bone."""
    for g in vert.groups:
        try:
            name = obj.vertex_groups[g.group].name.lower()
        except (IndexError, ReferenceError):
            continue
        if name in KEEP_BONES and g.weight > 0.001:
            return True
    return False


def extract(sex):
    src = os.path.join(SRC_DIR, f"Superhero_{sex}_FullBody.gltf")
    if not os.path.isfile(src):
        print(f"WARN: missing {src}, skipping {sex}")
        return None
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=src)

    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    print(f"{sex}: imported {len(meshes)} meshes")
    kept = []
    for obj in meshes:
        me = obj.data
        kill = [v.index for v in me.vertices if not keep_vertex(obj, v)]
        if kill:
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.mode_set(mode="EDIT")
            bpy.ops.mesh.select_all(action="DESELECT")
            bpy.ops.object.mode_set(mode="OBJECT")
            for i in kill:
                me.vertices[i].select = True
            bpy.ops.object.mode_set(mode="EDIT")
            bpy.ops.mesh.delete(type="VERT")
            bpy.ops.object.mode_set(mode="OBJECT")
        me.update()
        if len(me.vertices) == 0:
            bpy.data.objects.remove(obj, do_unlink=True)
            print(f"  {obj.name}: emptied, removed")
        else:
            kept.append(obj.name)
            print(f"  {obj.name}: kept {len(me.vertices)} verts")
    if not kept:
        print(f"WARN {sex}: no head geometry left!")
        return None

    # Copy the head's textures next to the .glb (downscale big normals).
    from PIL import Image
    for img in bpy.data.images:
        if not img.filepath or img.source == "GENERATED":
            continue
        src_path = bpy.path.abspath(img.filepath)
        if not os.path.isfile(src_path):
            continue
        dst_path = os.path.join(DST_DIR, os.path.basename(src_path))
        if "Normal" in dst_path:
            im = Image.open(src_path)
            if max(im.size) > MAX_NORMAL:
                im = im.resize(
                    (MAX_NORMAL, int(im.size[1] * MAX_NORMAL / im.size[0])),
                    Image.LANCZOS)
                im.save(dst_path)
                print(f"  downscaled {os.path.basename(dst_path)} -> {im.size}")
            else:
                shutil.copy2(src_path, dst_path)
        else:
            shutil.copy2(src_path, dst_path)
        img.filepath = dst_path

    out = os.path.join(DST_DIR, f"Head_{sex}.glb")
    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format="GLB",
        export_yup=True,
        export_skins=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
    )
    print(f"OK Head_{sex}: {os.path.getsize(out) / 1024:.0f} KB -> {out}")
    return out


def main():
    done = [r for r in (extract("Male"), extract("Female")) if r]
    print(f"Done: {len(done)}/2 heads")
    if len(done) != 2:
        sys.exit(1)


if __name__ == "__main__":
    main()
