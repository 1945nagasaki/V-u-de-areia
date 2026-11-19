import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FORAGE } from '../../config/forage.js';
import { FRUITS } from '../../config/foods.js';
import { BIOMES } from '../../config/biomes.js';
import { WORLD } from '../../config/worldConfig.js';
import {
  generateCell, cellsInRadius, cellKey, cellOf, selectActive, nearestReady,
  harvestNode, tickRegrowth, tickGrowIn, easeOutBack,
} from './fruitSpawn.js';

/** Interagível sem alvo: longe de tudo (mesma ideia de Game.NOWHERE). */
const NOWHERE = Object.freeze({ x: Infinity, y: 0, z: Infinity });

/**
 * Frutas colhíveis no mundo aberto (7 frutas × árvore/arbusto/chão).
 *
 * - Colocação: determinística por célula (fruitSpawn.js), presa às árvores e
 *   arbustos REAIS da Vegetation (lidos das matrizes das instâncias) + pontos
 *   espalhados por bioma. As células só são geradas quando o jogador chega perto.
 * - Desenho: um InstancedMesh por fruta (material único, cores por vértice,
 *   sem luzes novas); só os `maxActive` nós mais próximos dentro de
 *   `activeRadius` entram no buffer.
 * - Interação: UM interagível dinâmico cuja posição é o nó pronto mais
 *   perto; [E] → addItem(fruta) + toast + plim. A rebrota corre com o dt do jogo.
 *
 * Regras e números: src/config/forage.js. Frutas: FRUITS em foods.js.
 */
export class FruitNodes {
  /**
   * @param {object} game Game (usa vegetation, terrain, interactions, state, ui, player, areaId, scene)
   * @param {object} [cfg=FORAGE]
   */
  constructor(game, cfg = FORAGE) {
    this.game = game;
    this.cfg = cfg;
    this.fruitIds = Object.keys(FRUITS).filter((id) => cfg.models[id]);
    /** @type {Map<string, { nodes: object[], procHosts: object[] }>} células já geradas */
    this.cells = new Map();
    /** @type {Map<string, object[]>} hospedeiros reais por célula */
    this.hostsByCell = new Map();
    /** Nós colhidos esperando rebrotar / que estão "inchando" de volta. */
    this.regrowing = new Set();
    this.growing = new Set();
    /** Nós ativos (desenhados), do mais perto ao mais longe. */
    this.active = [];
    this.activeHosts = [];
    this.target = null;
    this._streamAt = null;
    this._dirty = true;
    this._w = new Float32Array(BIOMES.length);

    this.group = new THREE.Group();
    this.group.name = 'fruit-nodes';
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, metalness: 0 });
    this.meshes = {};
    for (const id of this.fruitIds) {
      const mesh = new THREE.InstancedMesh(buildFruitGeometry(id, cfg.models[id]), this.material, cfg.maxActive);
      mesh.count = 0;
      mesh.frustumCulled = false; // poucos nós, todos perto do jogador
      mesh.receiveShadow = true;
      mesh.name = `fruit-${id}`;
      this.meshes[id] = mesh;
      this.group.add(mesh);
    }
    this.hostMesh = new THREE.InstancedMesh(buildBushGeometry(cfg.procBush), this.material, cfg.maxHostBushes);
    this.hostMesh.count = 0;
    this.hostMesh.frustumCulled = false;
    this.hostMesh.receiveShadow = true;
    this.group.add(this.hostMesh);
    game.scene?.add(this.group);

    this.collectHosts(game.vegetation);

    const it = game.interactions?.register({
      id: 'fruit-harvest', label: cfg.text.label(''), radius: cfg.interactRadius,
      position: () => (this.target ? this._targetPos : NOWHERE),
      onInteract: () => this.harvest(this.target),
    });
    if (it) it.enabled = false;
    this.interactable = it ?? null;
    this._targetPos = { x: 0, y: 0, z: 0 };
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._audio = null;
  }

  /**
   * Lê as posições das árvores/arbustos reais da Vegetation (uma vez) e as
   * guarda por célula. Só os tipos citados em cfg.hosts interessam.
   * @param {object} [vegetation] instância de Vegetation (pode faltar: só ficam as regras `scatter`)
   */
  collectHosts(vegetation) {
    if (!vegetation?.geos || !vegetation.chunks) return;
    const byGeo = new Map();
    for (const [type, g] of Object.entries(vegetation.geos)) {
      if (!this.cfg.hosts[type]) continue;
      for (const v of Array.isArray(g) ? g : [g]) byGeo.set(v.hi, { type, height: v.height });
    }
    const cs = this.cfg.cellSize;
    for (const chunk of vegetation.chunks) {
      for (const mesh of chunk.hi.children) {
        const info = byGeo.get(mesh.geometry);
        if (!info) continue;
        const arr = mesh.instanceMatrix.array;
        for (let i = 0; i < mesh.count; i++) {
          const e = arr.slice(i * 16, i * 16 + 16);
          const host = { type: info.type, height: info.height, x: e[12], y: e[13], z: e[14], e };
          const { cx, cz } = cellOf(host.x, host.z, cs);
          const k = cellKey(cx, cz);
          if (!this.hostsByCell.has(k)) this.hostsByCell.set(k, []);
          this.hostsByCell.get(k).push(host);
        }
      }
    }
  }

  /** Id do bioma dominante em (x, z). */
  biomeAt(x, z) {
    const w = this.game.terrain.weightsAt(x, z, this._w);
    let best = 0;
    for (let b = 1; b < w.length; b++) if (w[b] > w[best]) best = b;
    return BIOMES[best].id;
  }

  /** Gera (uma vez) e devolve a célula. */
  cell(cx, cz) {
    const k = cellKey(cx, cz);
    let c = this.cells.get(k);
    if (!c) {
      const terrain = this.game.terrain;
      c = generateCell({
        cx, cz, cfg: this.cfg,
        hosts: this.hostsByCell.get(k) ?? [],
        biomeAt: (x, z) => this.biomeAt(x, z),
        heightAt: (x, z) => terrain.heightAt(x, z),
        waterLevel: WORLD.waterLevel,
      });
      this.cells.set(k, c);
    }
    return c;
  }

  /**
   * Nós (de qualquer estado) num raio em volta de (x, z) — gera as células se preciso.
   * @returns {object[]}
   */
  nodesNear(x, z, r) {
    const out = [];
    for (const { cx, cz } of cellsInRadius(x, z, r, this.cfg.cellSize)) {
      for (const n of this.cell(cx, cz).nodes) if (Math.hypot(n.x - x, n.z - z) <= r) out.push(n);
    }
    return out;
  }

  /** Recalcula quais nós ficam ativos em volta do jogador (respeita maxActive). */
  stream(x, z) {
    const { activeRadius, cellSize, maxActive, maxHostBushes } = this.cfg;
    const nodes = [], hosts = [];
    for (const { cx, cz } of cellsInRadius(x, z, activeRadius, cellSize)) {
      const c = this.cell(cx, cz);
      for (const n of c.nodes) nodes.push(n);
      for (const h of c.procHosts) if (Math.hypot(h.x - x, h.z - z) <= activeRadius) hosts.push(h);
    }
    this.active = selectActive(nodes, x, z, activeRadius, maxActive);
    hosts.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
    this.activeHosts = hosts.slice(0, maxHostBushes);
    this._streamAt = { x, z };
    this.writeHosts();
    this._dirty = true;
  }

  /**
   * Colhe um nó: addItem (dispara 'item-added'), some, toast e plim.
   * @param {object|null} node
   * @returns {boolean} se colheu
   */
  harvest(node) {
    if (!node || !harvestNode(node)) return false;
    this.regrowing.add(node);
    this.growing.delete(node);
    const name = FRUITS[node.fruit]?.name ?? node.fruit;
    this.game.state?.addItem(node.fruit, this.cfg.yield);
    this.game.ui?.toast(this.cfg.text.toast(this.cfg.yield, name));
    this.pluck();
    this.target = null;
    this._dirty = true;
    return true;
  }

  /**
   * Um quadro: rebrota (sempre, com dt), streaming, alvo do [E] e instâncias.
   * Fora do mundo aberto tudo some e o [E] desliga.
   * @param {number} dt segundos de jogo (0 = pausado)
   */
  update(dt) {
    const g = this.game;
    for (const n of tickRegrowth(this.regrowing, dt)) { this.growing.add(n); this._dirty = true; }
    if (this.growing.size) { tickGrowIn(this.growing, dt, this.cfg.growInSeconds); this._dirty = true; }

    const over = g.areaId === undefined || g.areaId === 'overworld';
    this.group.visible = over;
    if (!over || !g.player?.position) {
      this.target = null;
      if (this.interactable) this.interactable.enabled = false;
      return;
    }
    const p = g.player.position;
    const s = this._streamAt;
    if (!s || Math.hypot(p.x - s.x, p.z - s.z) > this.cfg.restreamDistance) this.stream(p.x, p.z);
    if (this._dirty) this.writeInstances();

    this.target = nearestReady(this.active, p.x, p.z, this.cfg.interactRadius);
    if (this.interactable) {
      this.interactable.enabled = !!this.target;
      if (this.target) {
        const t = this.target;
        this._targetPos.x = t.x; this._targetPos.z = t.z;
        // O [E] mede a altura em relação aos pés: usa o chão embaixo da fruta (a da copa é sacudida).
        this._targetPos.y = t.groundY;
        this.interactable.label = this.cfg.text.label(FRUITS[t.fruit]?.name ?? t.fruit);
      }
    }
  }

  /** Reescreve as matrizes das frutas ativas e prontas. */
  writeInstances() {
    const counts = {};
    for (const id of this.fruitIds) counts[id] = 0;
    const m = this._m, q = this._q, e = this._e, pos = this._p, scl = this._s;
    for (const n of this.active) {
      if (!n.ready) continue;
      const mesh = this.meshes[n.fruit];
      if (!mesh) continue;
      const k = n.scale * (n.grow >= 1 ? 1 : Math.max(0, easeOutBack(n.grow)));
      e.set(n.tilt, n.yaw, 0, 'YXZ');
      q.setFromEuler(e);
      m.compose(pos.set(n.x, n.y, n.z), q, scl.set(k, k, k));
      mesh.setMatrixAt(counts[n.fruit]++, m);
    }
    for (const id of this.fruitIds) {
      const mesh = this.meshes[id];
      mesh.count = counts[id];
      mesh.instanceMatrix.needsUpdate = true;
    }
    this._dirty = false;
  }

  /** Reescreve os arbustos procedurais (hospedeiros sem árvore real). */
  writeHosts() {
    const m = this._m, q = this._q, e = this._e, pos = this._p, scl = this._s;
    this.activeHosts.forEach((h, i) => {
      e.set(0, h.yaw, 0, 'YXZ');
      q.setFromEuler(e);
      m.compose(pos.set(h.x, h.y, h.z), q, scl.set(h.s, h.s, h.s));
      this.hostMesh.setMatrixAt(i, m);
    });
    this.hostMesh.count = this.activeHosts.length;
    this.hostMesh.instanceMatrix.needsUpdate = true;
  }

  /** Plim curto sintetizado (AudioContext criado no primeiro uso). */
  pluck() {
    try {
      const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!AC) return;
      this._audio ??= new AC();
      const ac = this._audio, S = this.cfg.sound, t = ac.currentTime;
      if (ac.state === 'suspended') ac.resume();
      const osc = ac.createOscillator(), gain = ac.createGain();
      osc.type = S.type;
      osc.frequency.setValueAtTime(S.freq, t);
      osc.frequency.exponentialRampToValueAtTime(S.freqEnd, t + S.decay);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(S.volume, t + S.attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + S.attack + S.decay);
      osc.connect(gain).connect(ac.destination);
      osc.start(t);
      osc.stop(t + S.attack + S.decay + 0.02);
    } catch { /* sem áudio: a colheita segue */ }
  }

  /** Libera geometrias e material. */
  dispose() {
    this.group.removeFromParent();
    for (const mesh of [...Object.values(this.meshes), this.hostMesh]) { mesh.geometry.dispose(); mesh.dispose(); }
    this.material.dispose();
    this._audio?.close?.();
  }
}

// ------------------------------------------------------------ modelos low-poly

/** Pinta a geometria (cor por vértice) e tira o uv (as partes se fundem iguais). */
function paint(geo, color) {
  const g = geo;
  g.deleteAttribute('uv');
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

function ellipsoid(r, [sx, sy, sz], [ws, hs], color) {
  return paint(new THREE.SphereGeometry(r, ws, hs).scale(sx, sy, sz), color);
}

function stemGeo(s, y) {
  return paint(new THREE.CylinderGeometry(s.radius, s.radius, s.length, 4).translate(0, y + s.length / 2, 0), s.color);
}

/**
 * Modelo de uma fruta (origem = ponto de pendurar/apoiar).
 * @param {string} id id em FRUITS
 * @param {object} md FORAGE.models[id]
 */
export function buildFruitGeometry(id, md) {
  const color = FRUITS[id]?.color ?? 0xffffff;
  const parts = [];
  if (md.shape === 'sphere') {
    parts.push(ellipsoid(md.radius, md.stretch, md.segments, color));
    if (md.stem) parts.push(stemGeo(md.stem, md.radius * md.stretch[1] * 0.9));
  } else if (md.shape === 'cluster') {
    const tints = md.tints ?? [color];
    for (let i = 0; i < md.count; i++) {
      // Espiral de Fibonacci achatada: cacho compacto e sempre igual.
      const a = i * 2.39996, r = md.spread * Math.sqrt((i + 0.5) / md.count);
      const y = -md.spread * 0.6 * (i / md.count);
      parts.push(ellipsoid(md.radius, md.stretch, md.segments, tints[i % tints.length])
        .translate(Math.cos(a) * r, y, Math.sin(a) * r));
    }
    if (md.stem) parts.push(stemGeo(md.stem, 0));
  } else if (md.shape === 'bunch') {
    // Cacho de banana: talo vertical + dedos (cápsulas) inclinados para fora em andares.
    const perTier = Math.ceil(md.fingers / md.tiers);
    for (let i = 0; i < md.fingers; i++) {
      const tier = Math.floor(i / perTier), a = (i % perTier) / perTier * Math.PI * 2 + tier * 0.4;
      const f = new THREE.CapsuleGeometry(md.radius, md.length, 2, 5);
      f.translate(0, md.length / 2, 0);
      f.rotateX(md.tilt + tier * 0.15);
      f.rotateY(a);
      f.translate(0, -tier * md.tierGap - md.stem.length * 0.25, 0);
      parts.push(paint(f, color));
    }
    parts.push(stemGeo(md.stem, -md.stem.length * 0.6));
  }
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  g.computeBoundingSphere();
  return g;
}

/** Arbusto procedural baixo (hospedeiro das moitas sem árvore real). */
function buildBushGeometry(pb) {
  const g = new THREE.IcosahedronGeometry(pb.radius, 0).scale(1, pb.height / (pb.radius * 2), 1).translate(0, pb.height / 2, 0);
  return paint(g, pb.color);
}
