# Unpack .unitypackage files (tar.gz of GUID folders: asset + pathname) without Unity.
# Keeps models + textures only. Usage: python3 tools/unpack_unitypackage.py <pkg-or-zip> <out-dir>
import io, os, sys, tarfile, zipfile
KEEP = ('.fbx', '.obj', '.png', '.jpg', '.jpeg', '.tga', '.psd', '.txt', '.pdf')
src, out = sys.argv[1], sys.argv[2]
if src.endswith('.zip'):
    z = zipfile.ZipFile(src)
    data = z.read(next(n for n in z.namelist() if n.endswith('.unitypackage')))
else:
    data = open(src, 'rb').read()
t = tarfile.open(fileobj=io.BytesIO(data), mode='r:gz')
members = {m.name: m for m in t.getmembers()}
n = 0
for name, m in members.items():
    if not name.endswith('/pathname'):
        continue
    path = t.extractfile(m).read().decode('utf-8', 'ignore').split('\n')[0].strip()
    asset = members.get(name[:-len('pathname')] + 'asset')
    if not asset or not path.lower().endswith(KEEP):
        continue
    rel = path[len('Assets/'):] if path.startswith('Assets/') else path
    dst = os.path.normpath(os.path.join(out, rel))
    if not dst.startswith(os.path.normpath(out)):  # no path traversal
        continue
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, 'wb') as f:
        f.write(t.extractfile(asset).read())
    n += 1
print(f'{os.path.basename(src)[:50]}: {n} files -> {out}')
