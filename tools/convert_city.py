#!/usr/bin/env python3
"""Convert the 28 Low Poly Bricks city .dae models to .glb.

Usage (headless):
    blender -b -P tools/convert_city.py

Reads:  tools/_work/models/*.dae   (unzipped from Low_Poly_Bricks_city/Models.zip)
Writes: public/assets/city/*.glb

Per model:
  - import .dae, join all mesh parts into one object
  - apply transforms, origin -> bottom-center (x/y centered, z at min)
  - keep material slots as-is (no textures embedded; palette PNGs are
    assigned at runtime in Three.js so houses can swap colorschemes)
  - export .glb (Blender Z-up -> glTF Y-up handled by the exporter)

Units in the .dae files are meters, so no rescaling is applied — the
report below prints each model's bounding-box size so scale can be
verified in the asset viewer.
"""
import bpy
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(REPO, "tools", "_work", "models")
DST = os.path.join(REPO, "public", "assets", "city")
os.makedirs(DST, exist_ok=True)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images,
                 bpy.data.armatures, bpy.data.curves):
        for x in list(coll):
            coll.remove(x)


def convert(fname):
    name = os.path.splitext(fname)[0]
    clear_scene()
    bpy.ops.wm.collada_import(filepath=os.path.join(SRC, fname))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not meshes:
        print(f"WARN {name}: no meshes imported, skipping")
        return None

    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active

    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # Bounding box in local space (= world space after applying transforms).
    corners = [obj.matrix_world @ __import__("mathutils").Vector(c)
               for c in obj.bound_box]
    xs = [c.x for c in corners]
    ys = [c.y for c in corners]
    zs = [c.z for c in corners]
    cx, cy, zmin = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)

    # Origin to bottom-center, then move object so its base sits at (0,0,0).
    bpy.context.scene.cursor.location = (cx, cy, zmin)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    obj.location = (0, 0, 0)

    out = os.path.join(DST, name + ".glb")
    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format="GLB",
        export_yup=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
    )
    size = (max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs))
    kb = os.path.getsize(out) / 1024
    print(f"OK {name}: size {size[0]:.2f} x {size[1]:.2f} x {size[2]:.2f} m, "
          f"{len(obj.data.materials)} material(s), {kb:.0f} KB")
    return name


def main():
    files = sorted(f for f in os.listdir(SRC) if f.endswith(".dae"))
    print(f"Converting {len(files)} models from {SRC}")
    done = []
    for f in files:
        r = convert(f)
        if r:
            done.append(r)
    print(f"Done: {len(done)}/{len(files)} models -> {DST}")
    if len(done) != len(files):
        sys.exit(1)


if __name__ == "__main__":
    main()
