# Apply Unity .mat settings (albedo/normal/emission textures, colour, transparency) to converted GLBs.
# Needs <root>/_guid2path.json (written while unpacking) and <root>/_material_map.json
# (GLB material name -> Unity .mat name, built from the pack's prefabs). Textures are linked as
# external URIs relative to each .glb. Usage: python3 tools/link_unity_materials.py <root>
import glob, json, os, re, struct, sys

root = sys.argv[1]
g2p = json.load(open(f'{root}/_guid2path.json'))
mmap = json.load(open(f'{root}/_material_map.json'))
mats = {os.path.splitext(os.path.basename(p))[0]: p for p in glob.glob(f'{root}/**/*.mat', recursive=True)}

def local(guid):
    p = g2p.get(guid)
    if not p: return None
    p = os.path.join(root, p[len('Assets/'):] if p.startswith('Assets/') else p)
    return p if os.path.exists(p) and p.lower().endswith(('.png', '.jpg')) else None

def parse(matpath):
    s = open(matpath, encoding='utf-8', errors='ignore').read()
    tex = lambda k: (m := re.search(rf'- {k}:\s*\n\s*m_Texture: {{fileID: \d+, guid: (\w+)', s)) and local(m.group(1))
    col = lambda k: (m := re.search(rf'- {k}: {{r: ([\d.e-]+), g: ([\d.e-]+), b: ([\d.e-]+), a: ([\d.e-]+)}}', s)) and [float(x) for x in m.groups()]
    mode = re.search(r'- _Mode: ([\d.]+)', s)
    return {'albedo': tex('_MainTex') or tex('_BaseMap'), 'normal': tex('_BumpMap'),
            'emis': tex('_EmissionMap') if '_EMISSION' in s else None,
            'color': col('_Color') or col('_BaseColor'), 'emisColor': col('_EmissionColor') if '_EMISSION' in s else None,
            'transparent': bool(mode and float(mode.group(1)) >= 2)}

done = 0
for f in glob.glob(f'{root}/**/*.glb', recursive=True):
    b = open(f, 'rb').read(); n = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + n])
    if j.get('images'): continue
    imgs, texs = j.setdefault('images', []), j.setdefault('textures', [])
    def ti(path):
        uri = os.path.relpath(path, os.path.dirname(f)).replace(os.sep, '/')
        for i, t in enumerate(texs):
            if imgs[t['source']]['uri'] == uri: return i
        imgs.append({'uri': uri}); texs.append({'source': len(imgs) - 1}); return len(texs) - 1
    hit = False
    for m in j.get('materials', []):
        u = mats.get(mmap.get(m.get('name')) or m.get('name'))
        if not u: continue
        p = parse(u); pbr = m.setdefault('pbrMetallicRoughness', {}); hit = True
        if p['albedo']: pbr['baseColorTexture'] = {'index': ti(p['albedo'])}
        if p['color']: pbr['baseColorFactor'] = p['color'][:3] + [p['color'][3] if p['transparent'] else 1]
        if p['normal']: m['normalTexture'] = {'index': ti(p['normal'])}
        if p['emisColor'] and max(p['emisColor'][:3]) > 0:
            m['emissiveFactor'] = [min(1, c) for c in p['emisColor'][:3]]
            if p['emis']: m['emissiveTexture'] = {'index': ti(p['emis'])}
        if p['transparent']: m['alphaMode'] = 'BLEND'
    if not imgs: j.pop('images'); j.pop('textures')
    if hit:
        js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * (-len(js) % 4)
        body = struct.pack('<II', len(js), 0x4E4F534A) + js + b[20 + n:]
        open(f, 'wb').write(b'glTF' + struct.pack('<II', 2, 12 + len(body)) + body); done += 1
print(f'linked materials in {done} files')
