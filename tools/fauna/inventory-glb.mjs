#!/usr/bin/env node
/**
 * Inventário de um arquivo GLB/glTF (somente leitura — o arquivo não é alterado):
 * metadados e licença, cenas, grupos de topo (candidatos a "um animal"),
 * malhas, materiais, texturas, esqueletos (skins) e clipes de animação, e a
 * quais ossos/skins cada clipe se aplica.
 *
 * Uso:
 *   node tools/fauna/inventory-glb.mjs <arquivo.glb> [--json] [--out relatorio.md]
 *
 * Exemplo:
 *   node tools/fauna/inventory-glb.mjs public/assets/models/animals/lobo.glb
 *   node tools/fauna/inventory-glb.mjs ultimate_animal_pack_100_animals__50_off.glb --out design/fauna/inventario-pacote.md
 *
 * Não classifica espécies sozinho: lista os nomes como estão no arquivo e marca
 * os grupos sem malha, sem skin ou sem clipe, para a triagem ser feita por quem lê.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

/** Lê o JSON de um .glb (contêiner binário) ou de um .gltf (texto). */
export function readGltfJson(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32LE(0) !== 0x46546c67) return { json: JSON.parse(buf.toString('utf8')), binBytes: 0, fileBytes: buf.length };
  const version = buf.readUInt32LE(4);
  if (version !== 2) throw new Error(`GLB versão ${version} não suportada (esperado 2)`);
  let off = 12, json = null, binBytes = 0;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4);
    if (type === 0x4e4f534a) json = JSON.parse(buf.toString('utf8', off + 8, off + 8 + len));
    else if (type === 0x004e4942) binBytes += len;
    off += 8 + len;
  }
  if (!json) throw new Error('GLB sem bloco JSON');
  return { json, binBytes, fileBytes: buf.length };
}

/**
 * Monta o inventário a partir do JSON do glTF.
 * @returns {object} { asset, totals, roots[], skins[], animations[], materials[], textures[] }
 */
export function inventory(json) {
  const nodes = json.nodes ?? [], meshes = json.meshes ?? [], skins = json.skins ?? [], anims = json.animations ?? [];
  const accessors = json.accessors ?? [], materials = json.materials ?? [], images = json.images ?? [], textures = json.textures ?? [];
  const parent = new Array(nodes.length).fill(-1);
  nodes.forEach((n, i) => { for (const c of n.children ?? []) parent[c] = i; });
  const rootOf = (i) => { let r = i; while (parent[r] >= 0) r = parent[r]; return r; };
  const sceneRoots = (json.scenes ?? []).flatMap((s) => s.nodes ?? []);
  // Um único nó de topo que só agrupa: desce um nível (o "pacote" costuma ser um grupo com um filho por item).
  let tops = sceneRoots.length ? sceneRoots : nodes.map((_, i) => i).filter((i) => parent[i] < 0);
  let wrapper = null;
  while (tops.length === 1 && nodes[tops[0]].mesh === undefined && (nodes[tops[0]].children ?? []).length > 1) { wrapper = nodes[tops[0]].name ?? `nó ${tops[0]}`; tops = nodes[tops[0]].children; }
  const topOf = (i) => { let r = i; while (parent[r] >= 0 && !tops.includes(r)) r = parent[r]; return r; };

  const triCount = (m) => (m.primitives ?? []).reduce((a, p) => {
    const n = p.indices !== undefined ? accessors[p.indices]?.count : accessors[p.attributes?.POSITION]?.count;
    return a + (p.mode === undefined || p.mode === 4 ? Math.floor((n ?? 0) / 3) : 0);
  }, 0);
  const vertCount = (m) => (m.primitives ?? []).reduce((a, p) => a + (accessors[p.attributes?.POSITION]?.count ?? 0), 0);

  const jointSkin = new Map(); // nó (osso) → índice da skin
  skins.forEach((s, si) => { for (const j of s.joints ?? []) if (!jointSkin.has(j)) jointSkin.set(j, si); });

  const roots = tops.map((t) => ({ node: t, name: nodes[t].name ?? `nó ${t}`, meshes: [], triangles: 0, vertices: 0, materials: new Set(), skins: new Set(), clips: new Set(), nodeCount: 0 }));
  const rootIx = new Map(tops.map((t, i) => [t, i]));
  nodes.forEach((n, i) => {
    const r = roots[rootIx.get(topOf(i))];
    if (!r) return;
    r.nodeCount++;
    if (n.mesh !== undefined) {
      const m = meshes[n.mesh];
      r.meshes.push(m.name ?? n.name ?? `malha ${n.mesh}`);
      r.triangles += triCount(m); r.vertices += vertCount(m);
      for (const p of m.primitives ?? []) if (p.material !== undefined) r.materials.add(materials[p.material]?.name ?? `material ${p.material}`);
    }
    if (n.skin !== undefined) r.skins.add(n.skin);
  });

  const animations = anims.map((a, ai) => {
    const targets = new Set((a.channels ?? []).map((c) => c.target?.node).filter((x) => x !== undefined));
    const skinsHit = new Set(), rootsHit = new Set();
    for (const t of targets) { if (jointSkin.has(t)) skinsHit.add(jointSkin.get(t)); const r = rootIx.get(topOf(t)); if (r !== undefined) rootsHit.add(r); }
    let duration = 0;
    for (const s of a.samplers ?? []) duration = Math.max(duration, accessors[s.input]?.max?.[0] ?? 0);
    const paths = new Set((a.channels ?? []).map((c) => c.target?.path));
    for (const r of rootsHit) roots[r].clips.add(a.name ?? `clipe ${ai}`);
    return { name: a.name ?? `clipe ${ai}`, duration, channels: (a.channels ?? []).length, nodes: targets.size, skins: [...skinsHit], roots: [...rootsHit].map((r) => roots[r].name), paths: [...paths] };
  });

  const texUse = new Map();
  materials.forEach((m, mi) => {
    const add = (slot, t) => { if (t?.index === undefined) return; const img = textures[t.index]?.source; const k = img ?? `t${t.index}`; const e = texUse.get(k) ?? { slots: new Set(), materials: new Set() }; e.slots.add(slot); e.materials.add(m.name ?? `material ${mi}`); texUse.set(k, e); };
    add('baseColor', m.pbrMetallicRoughness?.baseColorTexture); add('metalRough', m.pbrMetallicRoughness?.metallicRoughnessTexture);
    add('normal', m.normalTexture); add('occlusion', m.occlusionTexture); add('emissive', m.emissiveTexture);
  });
  const bufferViews = json.bufferViews ?? [];

  return {
    asset: { generator: json.asset?.generator, version: json.asset?.version, copyright: json.asset?.copyright, extras: json.asset?.extras ?? null, extensionsUsed: json.extensionsUsed ?? [], extensionsRequired: json.extensionsRequired ?? [] },
    wrapper,
    totals: { nodes: nodes.length, meshes: meshes.length, skins: skins.length, animations: anims.length, materials: materials.length, textures: textures.length, images: images.length, triangles: meshes.reduce((a, m) => a + triCount(m), 0) },
    roots: roots.map((r) => ({ ...r, materials: [...r.materials], skins: [...r.skins], clips: [...r.clips], status: r.meshes.length === 0 ? 'sem malha (vazio/auxiliar)' : r.skins.size === 0 ? 'estático (sem esqueleto)' : r.clips.size === 0 ? 'com esqueleto, SEM clipes' : 'com esqueleto e clipes' })),
    skins: skins.map((s, i) => ({ index: i, name: s.name ?? `skin ${i}`, joints: (s.joints ?? []).length, root: s.skeleton !== undefined ? nodes[s.skeleton]?.name : undefined, jointNames: (s.joints ?? []).slice(0, 12).map((j) => nodes[j]?.name ?? j) })),
    animations,
    materials: materials.map((m, i) => ({ name: m.name ?? `material ${i}`, alphaMode: m.alphaMode ?? 'OPAQUE', doubleSided: !!m.doubleSided, textured: !!m.pbrMetallicRoughness?.baseColorTexture, extensions: Object.keys(m.extensions ?? {}) })),
    images: images.map((im, i) => ({ index: i, name: im.name ?? im.uri ?? `imagem ${i}`, mimeType: im.mimeType ?? (im.uri ? 'externa' : '?'), bytes: im.bufferView !== undefined ? bufferViews[im.bufferView]?.byteLength : undefined, usedAs: [...(texUse.get(i)?.slots ?? [])], materials: [...(texUse.get(i)?.materials ?? [])] })),
  };
}

/** Relatório em Markdown. */
export function toMarkdown(inv, file, sizes) {
  const L = [], kb = (n) => (n === undefined ? '?' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} kB`);
  L.push(`# Inventário: ${basename(file)}`, '', `Arquivo: ${kb(sizes.fileBytes)} (binário ${kb(sizes.binBytes)}). Gerado por \`tools/fauna/inventory-glb.mjs\`; o arquivo original não foi alterado.`, '');
  L.push('## Metadados e licença', '', `- Gerador: ${inv.asset.generator ?? 'não informado'}`, `- Copyright: ${inv.asset.copyright ?? 'não informado'}`);
  if (inv.asset.extras) for (const [k, v] of Object.entries(inv.asset.extras)) L.push(`- extras.${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
  L.push(`- Extensões usadas: ${inv.asset.extensionsUsed.join(', ') || 'nenhuma'}${inv.asset.extensionsRequired.length ? ` (obrigatórias: ${inv.asset.extensionsRequired.join(', ')})` : ''}`, '');
  const t = inv.totals;
  L.push('## Totais', '', `${t.nodes} nós · ${t.meshes} malhas · ${t.skins} esqueletos (skins) · ${t.animations} clipes · ${t.materials} materiais · ${t.images} imagens · ${t.triangles.toLocaleString('pt-BR')} triângulos`, '');
  L.push(`## Grupos de topo${inv.wrapper ? ` (dentro de "${inv.wrapper}")` : ''}`, '', '| Grupo | Situação | Malhas | Triângulos | Materiais | Skins | Clipes |', '|---|---|---|---|---|---|---|');
  for (const r of inv.roots) L.push(`| ${r.name} | ${r.status} | ${r.meshes.length} | ${r.triangles.toLocaleString('pt-BR')} | ${r.materials.join(', ') || '—'} | ${r.skins.join(', ') || '—'} | ${r.clips.join(', ') || '—'} |`);
  L.push('', '## Esqueletos', '');
  if (!inv.skins.length) L.push('Nenhum.');
  for (const s of inv.skins) L.push(`- **${s.name}** (#${s.index}): ${s.joints} ossos${s.root ? `, raiz "${s.root}"` : ''}. Primeiros: ${s.jointNames.join(', ')}`);
  L.push('', '## Clipes de animação', '');
  if (!inv.animations.length) L.push('Nenhum.');
  else { L.push('| Clipe | Duração | Canais | Nós animados | Skins | Grupos | Propriedades |', '|---|---|---|---|---|---|---|'); for (const a of inv.animations) L.push(`| ${a.name} | ${a.duration.toFixed(2)} s | ${a.channels} | ${a.nodes} | ${a.skins.join(', ') || '—'} | ${a.roots.join(', ') || '—'} | ${a.paths.join(', ')} |`); }
  L.push('', '## Materiais', '', '| Material | Textura de cor | Alfa | Dupla face | Extensões |', '|---|---|---|---|---|');
  for (const m of inv.materials) L.push(`| ${m.name} | ${m.textured ? 'sim' : 'não'} | ${m.alphaMode} | ${m.doubleSided ? 'sim' : 'não'} | ${m.extensions.join(', ') || '—'} |`);
  L.push('', '## Imagens', '', '| # | Nome | Tipo | Tamanho | Uso | Materiais |', '|---|---|---|---|---|---|');
  for (const im of inv.images) L.push(`| ${im.index} | ${im.name} | ${im.mimeType} | ${kb(im.bytes)} | ${im.usedAs.join(', ') || 'sem uso'} | ${im.materials.join(', ') || '—'} |`);
  const noSkin = inv.roots.filter((r) => r.status.startsWith('estático')).length, noClip = inv.roots.filter((r) => r.status.includes('SEM clipes')).length, ok = inv.roots.filter((r) => r.status === 'com esqueleto e clipes').length;
  L.push('', '## Resumo para a triagem', '', `- ${ok} grupo(s) com esqueleto e clipes; ${noClip} com esqueleto mas sem clipes; ${noSkin} estático(s); ${inv.roots.length - ok - noClip - noSkin} sem malha.`, '- A identificação da espécie e a separação de objetos decorativos/promocionais são manuais: use os nomes acima e a área de teste (`tools/fauna/viewer.html`).', '');
  return L.join('\n');
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain) {
  const args = process.argv.slice(2), file = args.find((a) => !a.startsWith('--'));
  if (!file) { console.error('uso: node tools/fauna/inventory-glb.mjs <arquivo.glb> [--json] [--out relatorio.md]'); process.exit(1); }
  const { json, binBytes, fileBytes } = readGltfJson(file);
  const inv = inventory(json);
  const out = args.includes('--json') ? JSON.stringify(inv, null, 1) : toMarkdown(inv, file, { binBytes, fileBytes });
  const o = args.indexOf('--out');
  if (o >= 0 && args[o + 1]) { writeFileSync(args[o + 1], out); console.log(`escrito: ${args[o + 1]}`); } else console.log(out);
}
