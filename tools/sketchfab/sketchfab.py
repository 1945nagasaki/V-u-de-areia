"""Ferramenta do Sketchfab (API v3) para buscar e baixar modelos animados.

A chave de API é injetada pelo proxy da sessão em api.sketchfab.com — o
código não lê nem guarda o token. Só aceita licenças que permitem uso no
jogo: CC0 e CC Attribution (sem NonCommercial / NoDerivs).

Uso:
  python3 tools/sketchfab/sketchfab.py search "crocodile" [n]
  python3 tools/sketchfab/sketchfab.py fetch <uid> <pasta_destino>
"""
import json, os, sys, urllib.parse, urllib.request

API = 'https://api.sketchfab.com/v3'
ALLOWED = {'CC Attribution', 'CC0 Public Domain'}  # nomes como a API devolve


def get(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)


def search(q, n=8):
    qs = urllib.parse.urlencode({'type': 'models', 'q': q, 'animated': 'true', 'downloadable': 'true', 'count': 24, 'sort_by': '-likeCount'})
    d = get(f'{API}/search?{qs}')
    out = []
    for m in d.get('results', []):
        if (m.get('license') or {}).get('label') not in ALLOWED:
            continue
        out.append({'uid': m['uid'], 'name': m['name'], 'author': (m.get('user') or {}).get('username'),
                    'license': m['license']['label'], 'anims': m.get('animationCount'), 'faces': m.get('faceCount'),
                    'url': m.get('viewerUrl')})
        if len(out) >= n:
            break
    return out


def fetch(uid, dest):
    info = get(f'{API}/models/{uid}')
    lic = (info.get('license') or {}).get('label')
    if lic not in ALLOWED:
        raise SystemExit(f'licença não permitida: {lic}')
    links = get(f'{API}/models/{uid}/download')
    os.makedirs(dest, exist_ok=True)
    path = os.path.join(dest, 'model.glb')
    urllib.request.urlretrieve(links['glb']['url'], path)
    meta = {'uid': uid, 'name': info['name'], 'author': info['user']['username'], 'authorName': info['user'].get('displayName'),
            'license': lic, 'url': info['viewerUrl'], 'file': path}
    json.dump(meta, open(os.path.join(dest, 'source.json'), 'w'), ensure_ascii=False, indent=1)
    return meta


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'search':
        print(json.dumps(search(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 8), ensure_ascii=False))
    elif cmd == 'fetch':
        print(json.dumps(fetch(sys.argv[2], sys.argv[3]), ensure_ascii=False))
