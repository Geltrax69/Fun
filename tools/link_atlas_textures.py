# Unity packs keep texture assignments in .mat files, so converted GLBs come out untextured.
# This links each material to its atlas PNG (external URI, relative to the .glb), in place.
# Usage: python3 tools/link_atlas_textures.py
import glob, json, os, struct

U = 'asset_packs_unity'
RULES = {  # pack -> function(material name) -> png path or None
    'POLY_MegapolisCityPack': lambda m: f'{U}/POLY_MegapolisCityPack/Polygon-City Megapolis/Textures/Polygon_Texture.png',
    'ToonyTinyCityExtended': lambda m: {
        'M_City_01': 'T_City', 'City_A': 'T_City', 'M_City_Extended': 'T_City_Extended', 'M_Cars': 'T_Cars', 'lambert6': 'T_Cars',
    }.get(m) and f'{U}/ToonyTinyCityExtended/Tiny_Toony_City_Extended/Textures/' + {
        'M_City_01': 'T_City', 'City_A': 'T_City', 'M_City_Extended': 'T_City_Extended', 'M_Cars': 'T_Cars', 'lambert6': 'T_Cars'}[m] + '.png',
    'LowPolyVegetationKit': lambda m: m in ('Color Pallet', 'Grass', 'Pine Tree Branch', 'Plant Leaf')
        and f'{U}/LowPolyVegetationKit/Low Poly Vegetation Kit/Textures/{m}.png',
}
CUTOUT = {'Pine Tree Branch', 'Plant Leaf', 'Grass'}  # leaf cards need alpha-test

def patch(path, rule):
    b = open(path, 'rb').read()
    n = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + n])
    if j.get('images'):
        return False
    changed = False
    for m in j.get('materials', []):
        png = rule(m.get('name', ''))
        if not png or not os.path.exists(png):
            continue
        uri = os.path.relpath(png, os.path.dirname(path)).replace(os.sep, '/')
        imgs = j.setdefault('images', [])
        idx = next((i for i, im in enumerate(imgs) if im['uri'] == uri), None)
        if idx is None:
            imgs.append({'uri': uri})
            j.setdefault('textures', []).append({'source': len(imgs) - 1})
            idx = len(imgs) - 1
        pbr = m.setdefault('pbrMetallicRoughness', {})
        pbr['baseColorTexture'] = {'index': idx}
        pbr['baseColorFactor'] = [1, 1, 1, 1]
        if m.get('name') in CUTOUT:
            m['alphaMode'], m['alphaCutoff'], m['doubleSided'] = 'MASK', 0.5, True
        changed = True
    if changed:
        js = json.dumps(j, separators=(',', ':')).encode()
        js += b' ' * (-len(js) % 4)
        body = struct.pack('<II', len(js), 0x4E4F534A) + js + b[20 + n:]
        open(path, 'wb').write(b'glTF' + struct.pack('<II', 2, 12 + len(body)) + body)
    return changed

for pack, rule in RULES.items():
    files = glob.glob(f'{U}/{pack}/**/*.glb', recursive=True)
    print(pack, sum(patch(f, rule) for f in files), 'of', len(files), 'linked')
