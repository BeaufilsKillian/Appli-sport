"""Encodage WebP haute qualité ; vérifie les images, leur géométrie et leur durée."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageChops, ImageSequence, ImageStat

root = Path(__file__).resolve().parent.parent
sources = json.loads((root / 'assets/exercise-demos/sources.json').read_text(encoding='utf-8'))
unique = {entry['sourceId']: entry for entry in sources.values()}

def encode(item):
    source_id, entry = item
    source = root / f'assets/exercise-demos/{source_id}.gif'
    target = source.with_suffix('.webp')
    with Image.open(source) as original:
        frames = [frame.convert('RGBA') for frame in ImageSequence.Iterator(original)]
        durations = [frame.info.get('duration', 100) for frame in ImageSequence.Iterator(original)]
        frames[0].save(target, 'WEBP', save_all=True, append_images=frames[1:], duration=durations,
                       loop=original.info.get('loop', 0), lossless=False, quality=95, method=5)
    with Image.open(target) as encoded:
        assert encoded.n_frames == len(frames), f'Nombre d’images différent : {source_id}'
        for index, expected in enumerate(frames):
            encoded.seek(index)
            actual = encoded.convert('RGBA')
            assert actual.size == expected.size, f'Résolution différente : {source_id}/{index}'
            difference = ImageStat.Stat(ImageChops.difference(actual, expected)).mean
            assert max(difference[:3]) < 5 and difference[3] == 0, f'Écart de qualité excessif : {source_id}/{index}'
            assert encoded.info['duration'] == durations[index], f'Durée différente : {source_id}/{index}'
    return {'file': target.name, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
            'source': entry['media'], 'frames': len(frames), 'bytes': target.stat().st_size}

manifest = []
with ThreadPoolExecutor(max_workers=2) as pool:
    for result in pool.map(encode, unique.items()):
        manifest.append(result)
        if len(manifest) % 25 == 0:
            print(f'{len(manifest)}/{len(unique)} animations encodées et vérifiées', flush=True)
(root / 'scripts/media-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
native_map = (root / 'src/exerciseDemos.ts').read_text(encoding='utf-8')
(root / 'src/exerciseDemos.web.ts').write_text(native_map.replace('.gif"', '.webp"'), encoding='utf-8')
print(f'OK : {len(manifest)} animations, {sum(item["bytes"] for item in manifest) / 1_000_000:.1f} Mo, résolution, images et durées conservées, qualité vérifiée.', flush=True)
