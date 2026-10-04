# Post-fix FBX->GLB conversions (run after tools/fbx_to_glb.py), in place:
#  - materials exported with alpha 0 + MASK (render invisible) -> opaque
#  - clip names like "Armature|Armature|Walk" -> "Walk"
# Usage: python3 tools/fix_converted_glb.py [root=asset_packs]
import glob, json, struct, sys

def fix(path):
    b = open(path, 'rb').read()
    n = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + n])
    changed = 0
    for m in j.get('materials', []):
        pbr = m.setdefault('pbrMetallicRoughness', {})
        f = pbr.get('baseColorFactor', [1, 1, 1, 1])
        if f[3] < 0.05:
            pbr['baseColorFactor'] = f[:3] + [1.0]
            m.pop('alphaMode', None)
            m.pop('alphaCutoff', None)
            changed += 1
    for a in j.get('animations', []):
        if '|' in a.get('name', ''):
            a['name'] = a['name'].rsplit('|', 1)[1]
            changed += 1
    if not changed:
        return 0
    js = json.dumps(j, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    rest = b[20 + n:]
    body = struct.pack('<II', len(js), 0x4E4F534A) + js + rest
    open(path, 'wb').write(b'glTF' + struct.pack('<II', 2, 12 + len(body)) + body)
    return changed

if __name__ == '__main__':
    root = sys.argv[1] if len(sys.argv) > 1 else 'asset_packs'
    files = glob.glob(f'{root}/**/*.glb', recursive=True)
    hit = sum(1 for f in files if fix(f))
    print(f'fixed {hit} of {len(files)} files')
