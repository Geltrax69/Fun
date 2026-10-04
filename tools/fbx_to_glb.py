# Convert every .fbx under asset_packs/ to a .glb beside it (then drop the .fbx).
# Usage: [ROOT=asset_packs] [APPLY=1] /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/fbx_to_glb.py
import bpy, glob, os, sys
ROOT = os.environ.get('ROOT', 'asset_packs')
files = sorted(glob.glob(f'{ROOT}/**/*.fbx', recursive=True) + glob.glob(f'{ROOT}/**/*.FBX', recursive=True))
ok = fail = 0
for f in files:
    out = os.path.splitext(f)[0] + '.glb'
    bpy.ops.wm.read_factory_settings(use_empty=True)
    try:
        bpy.ops.import_scene.fbx(filepath=f, ignore_leaf_bones=True)
        # Unity FBX often mix unit scales per object (e.g. hair 100x the body); bake
        # every object's transform so the GLB is consistent at runtime.
        if os.environ.get('APPLY'):
            for o in bpy.context.scene.objects: o.select_set(True)
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True)
        os.remove(f); ok += 1
    except Exception as e:
        fail += 1; print('FAIL', f, e, file=sys.stderr)
print(f'converted {ok}, failed {fail}')
