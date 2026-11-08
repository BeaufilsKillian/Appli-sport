"""Import des médias demandés par l'utilisateur, avec correspondances explicites.
Ne copie ni descriptions ni articles. Conserve la provenance des fichiers.
Utilisation : python scripts/import-docteur-fitness.py
Pillow est nécessaire pour extraire les miniatures fixes.
"""
import concurrent.futures
import html
import io
import json
import pathlib
import re
import urllib.request
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = 'https://www.docteur-fitness.com/'
DEST = ROOT / 'assets' / 'exercise-demos'
DEST.mkdir(parents=True, exist_ok=True)

def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'TrainingProgramme-PersonalMediaImport/1.0'})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()

library = json.loads(fetch(BASE + 'wp-json/dfth/v1/lib'))
source = {row[0]: row for row in library['x']}
# Correspondances vérifiées par nom, équipement et variante. Pas de rapprochement flou.
links = {
 'bench':57472, 'incline':19373, 'fly':19333, 'shoulder':27366,
 'lateral':20193, 'triceps':21275, 'pullup':26987, 'latpull':21622,
 'row':26995, 'rowbar':20843, 'rear':22508, 'curl':33776,
 'curlhammer':34168, 'squat':21613, 'legpress':33760, 'rdl':29961,
 'legcurl':26997, 'calves':21252, 'plank':30999,
 'ex020':19194, 'ex021':33051, 'ex024':22509, 'ex025':22485,
 'ex026':21254, 'ex029':23176, 'ex030':36694, 'ex031':86109,
 'ex032':19292, 'ex033':86158, 'ex034':34397, 'ex035':34822,
 'ex036':19333, 'ex038':34789, 'ex039':19315, 'ex041':9723,
 'ex049':22507, 'ex050':27363, 'ex051':20624, 'ex052':35497,
 'ex053':26982, 'ex054':26980, 'ex055':23175, 'ex056':20641,
 'ex057':23179, 'ex059':86146, 'ex060':27363,
 'ex061':20462, 'ex062':25017, 'ex063':20499, 'ex064':35495,
 'ex067':25030, 'ex068':36481, 'ex069':26995, 'ex070':35143,
 'ex071':25025, 'ex072':27358, 'ex073':31005,
 'ex076':23182, 'ex078':36856, 'ex079':25013,
 'ex081':20475, 'ex082':27365, 'ex083':25022, 'ex084':23156,
 'ex085':21011, 'ex086':20062, 'ex087':44648, 'ex088':33068,
 'ex089':20165, 'ex090':36879, 'ex093':26990, 'ex094':27367,
 'ex096':36934, 'ex097':20249, 'ex099':30005, 'ex101':75099,
 'ex102':75119, 'ex103':22505, 'ex104':22508, 'ex105':22505,
 'ex108':30009, 'ex109':67529, 'ex110':75115, 'ex111':31003,
 'ex112':20878, 'ex114':24476, 'ex115':21194, 'ex116':20964,
 'ex118':24479, 'ex119':86149, 'ex120':21208, 'ex121':20916,
 'ex122':25031, 'ex124':23178, 'ex127':29991,
 'ex132':21275, 'ex137':29979, 'ex138':37348, 'ex139':34842,
 'ex140':30001, 'ex141':20899, 'ex142':37320,
 'ex144':37458, 'ex145':20933, 'ex146':10266,
 'ex147':30015, 'ex148':30903, 'ex150':36981, 'ex151':26217,
 'ex152':22506, 'ex153':19573, 'ex154':37591, 'ex155':29798,
 'ex156':24482, 'ex158':23158, 'ex159':22484,
 'ex162':21271, 'ex163':26981, 'ex164':24461,
 'ex166':26996, 'ex167':19450, 'ex168':19421, 'ex169':26999,
 'ex170':19495, 'ex176':19434, 'ex178':19398, 'ex180':21620,
 'ex182':29859, 'ex185':21013, 'ex186':21249, 'ex188':21250,
 'ex191':22493, 'ex192':30989, 'ex193':35785,
 'ex194':21255, 'ex195':33772, 'ex196':33390, 'ex197':21256,
 'ex202':68202, 'ex204':31078, 'ex205':75168, 'ex208':33785,
 'ex209':21251, 'ex210':21001, 'ex211':33468, 'ex212':21015,
 'ex214':21274, 'ex215':26998,
 'ex217':19959, 'ex218':19633, 'ex219':29807, 'ex220':19697,
 'ex222':19936, 'ex223':25019, 'ex226':26218, 'ex227':25024,
 'ex229':29969, 'ex230':36625, 'ex231':29985, 'ex232':30011,
 'ex236':19613, 'ex237':31122, 'ex238':32222,
 'ex239':86079, 'ex240':86073, 'ex244':75060,
}
# Noms exacts pour le cardio, dont les identifiants du site peuvent évoluer.
by_name = {row[1].casefold(): row[0] for row in library['x']}
for local_id, name in {'ex250':'Vélo elliptique','ex251':'Rameur', 'ex253':'Corde à sauter', 'ex254':'Burpees', 'ex255':'Assault bike', 'ex256':'SkiErg'}.items():
    if name.casefold() in by_name:
        links[local_id] = by_name[name.casefold()]

def import_one(source_id):
    row = source[source_id]
    gif_path = DEST / f'{source_id}.gif'
    png_path = DEST / f'{source_id}.png'
    metadata_path = DEST / f'{source_id}.json'
    if metadata_path.exists() and gif_path.exists() and png_path.exists():
        return source_id, json.loads(metadata_path.read_text(encoding='utf-8'))
    # Articles WordPress et fiches express ont des contenus différents.
    if row[2] == 1:
        page = fetch(BASE + row[4]).decode('utf-8')
        # La fiche express fournit sa propre animation dans les données publiques.
        urls = re.findall(r'(?:https?:)?[^\s<>"\x27]+\.gif', html.unescape(page))
    else:
        post = json.loads(fetch(BASE + f'wp-json/wp/v2/posts/{source_id}?_fields=content'))
        page = html.unescape(post['content']['rendered'])
        urls = re.findall(r'https?[^\s<>"\x27]+\.gif', page)
    if not urls:
        raise ValueError('aucun GIF dans la fiche')
    gif_url = urls[0]
    if gif_url.startswith('//'):
        gif_url = 'https:' + gif_url
    data = fetch(gif_url)
    image = Image.open(io.BytesIO(data))
    if image.format != 'GIF' or getattr(image, 'n_frames', 1) < 2:
        raise ValueError('le fichier n’est pas une animation GIF')
    gif_path.write_bytes(data)
    image.seek(0)
    poster = image.convert('RGBA')
    poster.thumbnail((320, 320))
    poster.save(png_path)
    meta = {'title': row[1], 'page': BASE + row[4], 'media': gif_url,
            'width': image.width, 'height': image.height, 'frames': image.n_frames,
            'bytes': len(data)}
    metadata_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
    return source_id, meta

# Variantes dont le matériel, l'appui ou la trajectoire diffèrent : pas de substitution.
for local_id in ('ex068', 'ex072', 'ex073', 'ex087', 'ex096', 'ex104', 'ex122',
                 'ex127', 'ex137', 'ex145', 'ex146', 'ex193', 'ex197'):
    links.pop(local_id, None)
links['ex133'] = 29979  # Extension triceps à la poulie, barre droite.

results, errors = {}, []
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    futures = {pool.submit(import_one, source_id): source_id for source_id in set(links.values())}
    for future in concurrent.futures.as_completed(futures):
        try:
            source_id, meta = future.result()
            results[source_id] = meta
        except Exception as error:
            errors.append({'id': futures[future], 'error': str(error)})
        if (len(results) + len(errors)) % 20 == 0:
            print(f'{len(results)} médias importés, {len(errors)} sans média vérifié', flush=True)

manifest = {local_id: {'sourceId': source_id, **results[source_id]}
            for local_id, source_id in links.items() if source_id in results}
(DEST / 'sources.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
(ROOT / '.expo' / 'df-import-errors.json').write_text(json.dumps(errors, ensure_ascii=False, indent=2), encoding='utf-8')
lines = ["// Médias Docteur Fitness demandés par l'utilisateur ; provenance dans assets/exercise-demos/sources.json.",
         "import type { ImageSourcePropType } from 'react-native';",
         "export type ExerciseDemo = { animation: ImageSourcePropType; poster: ImageSourcePropType; page: string; width: number; height: number };",
         'export const EXERCISE_DEMOS: Record<string, ExerciseDemo> = {']
for local_id, meta in manifest.items():
    source_id = meta['sourceId']
    lines.append(f'  {json.dumps(local_id)}: {{ animation: require("../assets/exercise-demos/{source_id}.gif"), poster: require("../assets/exercise-demos/{source_id}.png"), page: {json.dumps(meta["page"])}, width: {meta["width"]}, height: {meta["height"]} }},')
lines.append('};\n')
(ROOT / 'src' / 'exerciseDemos.ts').write_text('\n'.join(lines), encoding='utf-8')
print(f'Terminé : {len(manifest)} exercices associés, {len(results)} GIF, {sum(x["bytes"] for x in results.values()) / 1024**2:.1f} Mo.', flush=True)
if errors:
    print('Fiches sans média vérifié : ' + str(errors), flush=True)
