# Convert every .fbx under asset_packs/ to a .glb beside it (then drop the .fbx).
# Usage: /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/fbx_to_glb.py
import bpy, glob, os, sys
files = sorted(glob.glob('asset_packs/**/*.fbx', recursive=True) + glob.glob('asset_packs/**/*.FBX', recursive=True))
ok = fail = 0
for f in files:
    out = os.path.splitext(f)[0] + '.glb'
    bpy.ops.wm.read_factory_settings(use_empty=True)
    try:
        bpy.ops.import_scene.fbx(filepath=f)
        bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True)
        os.remove(f); ok += 1
    except Exception as e:
        fail += 1; print('FAIL', f, e, file=sys.stderr)
print(f'converted {ok}, failed {fail}')
