import * as THREE from 'three';
import { WORK_DEBUG } from '../config/workplaces.js';
import { PROFESSIONS } from '../config/npcLife.js';

/**
 * Modo de depuração do trabalho (tecla F9, ou `?debugwork` na URL).
 * Mostra, perto do jogador:
 *  - estações (verde livre · vermelho ocupada · laranja com falha recente), entradas dos prédios;
 *  - rota e destino de cada morador com boneco;
 *  - colisores e células bloqueadas da navegação (alcance curto);
 *  - etiqueta por morador: profissão, estado de IA, estação e motivo de falha, altura do chão.
 * Desligado, não custa nada e não muda a jogabilidade.
 *
 * @example
 * const dbg = new WorkDebug(game);
 * dbg.toggle();          // F9
 * dbg.update(dt);        // no loop (só trabalha quando ligado)
 */
export class WorkDebug {
  constructor(game, cfg = WORK_DEBUG) {
    this.game = game;
    this.cfg = cfg;
    this.on = false;
    this.group = new THREE.Group();
    this.group.name = 'work-debug';
    this.group.userData.noCollide = true;
    this.group.visible = false;
    game.scene.add(this.group);
    this.mats = {
      free: new THREE.MeshBasicMaterial({ color: 0x3ad06a, depthTest: false, transparent: true, opacity: 0.85 }),
      busy: new THREE.MeshBasicMaterial({ color: 0xe0443a, depthTest: false, transparent: true, opacity: 0.85 }),
      fail: new THREE.MeshBasicMaterial({ color: 0xf0a020, depthTest: false, transparent: true, opacity: 0.85 }),
      visit: new THREE.MeshBasicMaterial({ color: 0x5aa8ff, depthTest: false, transparent: true, opacity: 0.8 }),
      door: new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.7 }),
      route: new THREE.LineBasicMaterial({ color: 0xffe066, depthTest: false }),
      collider: new THREE.LineBasicMaterial({ color: 0xff5ad0, depthTest: false, transparent: true, opacity: 0.6 }),
      nav: new THREE.PointsMaterial({ color: 0xff3a3a, size: 0.25, depthTest: false }),
    };
    this.marker = new THREE.CylinderGeometry(0.22, 0.22, 0.08, 10);
    this.markers = new THREE.Group();
    this.lines = new THREE.Group();
    this.group.add(this.markers, this.lines);
    this.labels = document.createElement('div');
    this.labels.className = 'work-debug-labels';
    this.labels.hidden = true;
    game.ui.root.appendChild(this.labels);
    this.panel = document.createElement('div');
    this.panel.className = 'work-debug-panel';
    this.panel.hidden = true;
    game.ui.root.appendChild(this.panel);
    this._t = 0;
    this._v = new THREE.Vector3();
    if (new URLSearchParams(globalThis.location?.search ?? '').has('debugwork')) this.toggle(true);
  }

  toggle(force) {
    this.on = force ?? !this.on;
    this.group.visible = this.labels.hidden = this.panel.hidden = !this.on;
    this.group.visible = this.on;
    this.labels.hidden = !this.on;
    this.panel.hidden = !this.on;
    this._t = 0;
    if (this.on) this.rebuild();
    this.game.ui.toast(`Depuração do trabalho ${this.on ? 'ligada' : 'desligada'} (${this.cfg.key}).`);
  }

  /** Refaz marcadores, colisores e células perto do jogador (a cada 1 s). */
  rebuild() {
    const g = this.game, nm = g.npcManager, work = nm?.work, p = g.player.position;
    for (const grp of [this.markers, this.lines]) { for (const c of grp.children) c.geometry !== this.marker && c.geometry?.dispose(); grp.clear(); }
    if (!work) return;
    const R = 60;
    for (const st of work.registry.stations.values()) {
      if (Math.hypot(st.x - p.x, st.z - p.z) > R) continue;
      const fail = st.blockedUntil > (st.occupants[0] ? 0 : nm.clockSeconds ?? 0) && st.lastFail;
      const m = new THREE.Mesh(this.marker, st.role === 'visitor' ? this.mats.visit : st.occupants.length ? this.mats.busy : fail ? this.mats.fail : this.mats.free);
      m.position.set(st.x, st.y + 0.05, st.z);
      m.renderOrder = 20;
      this.markers.add(m);
    }
    for (const vs of nm.villages) for (const b of vs.work?.buildings ?? []) {
      if (Math.hypot(b.x - p.x, b.z - p.z) > R + 20) continue;
      const m = new THREE.Mesh(this.marker, this.mats.door);
      m.scale.set(1.6, 1, 1.6);
      m.position.set(b.entrance.x, g.terrain.heightAt(b.entrance.x, b.entrance.z) + 0.06, b.entrance.z);
      m.renderOrder = 20;
      this.markers.add(m);
    }
    // colisores (contorno) e células bloqueadas da grade, perto
    const seg = [], cells = [];
    for (const c of g.collisions.all) {
      if (c.enabled === false || Math.hypot(c.x - p.x, c.z - p.z) > 22) continue;
      const y = g.terrain.heightAt(c.x, c.z) + 0.1;
      if (c.type === 'circle') {
        for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283, b = ((i + 1) / 12) * 6.283; seg.push(c.x + Math.cos(a) * c.r, y, c.z + Math.sin(a) * c.r, c.x + Math.cos(b) * c.r, y, c.z + Math.sin(b) * c.r); }
      } else {
        const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => { const lx = a * c.hw, lz = b * c.hd; return [c.x + lx * c.cos + lz * c.sin, c.z - lx * c.sin + lz * c.cos]; });
        for (let i = 0; i < 4; i++) { const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % 4]; seg.push(ax, y, az, bx, y, bz); }
      }
    }
    for (const vs of nm.villages) {
      const nav = vs.work?.nav;
      if (!nav || Math.hypot(vs.center.x - p.x, vs.center.z - p.z) > vs.village.radius + 100) continue;
      const i0 = Math.floor((p.x - 18 - nav.minX) / nav.cell), j0 = Math.floor((p.z - 18 - nav.minZ) / nav.cell);
      for (let j = j0; j < j0 + 36; j++) for (let i = i0; i < i0 + 36; i++) if (nav.inside(i, j) && !nav.free(i, j)) { const x = nav.cx(i), z = nav.cz(j); cells.push(x, g.terrain.heightAt(x, z) + 0.15, z); }
    }
    if (seg.length) { const ls = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(seg, 3)), this.mats.collider); ls.renderOrder = 19; this.lines.add(ls); }
    if (cells.length) { const pts = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(cells, 3)), this.mats.nav); pts.renderOrder = 19; this.lines.add(pts); }
    this._routes = new THREE.Group();
    this.lines.add(this._routes);
  }

  update(dt) {
    if (!this.on) return;
    const g = this.game, nm = g.npcManager;
    if (!nm) return;
    this._t -= dt;
    if (this._t <= 0) { this._t = 1; this.rebuild(); this.panelText(); }
    // rotas e etiquetas dos moradores com boneco
    for (const c of this._routes?.children ?? []) c.geometry.dispose();
    this._routes?.clear();
    const cam = g.camera, W = window.innerWidth, H = window.innerHeight, html = [];
    let n = 0;
    for (const a of nm.rendering ?? []) {
      if (!a.rendered || a.indoors) continue;
      const pts = [a.pos.x, a.pos.y + 0.2, a.pos.z];
      for (const q of a.route) pts.push(q.x, g.terrain.heightAt(q.x, q.z) + 0.2, q.z);
      if (pts.length > 3) { const l = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)), this.mats.route); l.renderOrder = 21; this._routes.add(l); }
      if (n >= this.cfg.maxLabels || Math.hypot(a.pos.x - g.player.position.x, a.pos.z - g.player.position.z) > this.cfg.labelRadius) continue;
      this._v.set(a.pos.x, a.pos.y + 2.2, a.pos.z).project(cam);
      if (this._v.z > 1) continue;
      n++;
      const st = a.job?.station ?? a.goal?.station;
      const prof = PROFESSIONS[a.person.profession]?.name ?? (a.person.age === 'adult' ? 'sem ofício' : a.person.age === 'child' ? 'criança' : 'idoso');
      html.push(`<div class="wdl${a.workFail ? ' fail' : ''}" style="left:${((this._v.x + 1) / 2 * W).toFixed(0)}px;top:${((1 - this._v.y) / 2 * H).toFixed(0)}px">`
        + `<b>${prof}</b> · ${a.aiState}<br>${st ? st.id.split(':').slice(1).join(':') : a.goal?.key ?? ''}`
        + `${a.workFail ? `<br><em>${a.workFail}</em>` : ''}<br><small>y ${a.pos.y.toFixed(2)} · chão ${g.groundHeight(a.pos.x, a.pos.z, a.pos.y + 0.3).toFixed(2)}</small></div>`);
    }
    this.labels.innerHTML = html.join('');
  }

  panelText() {
    const nm = this.game.npcManager, w = nm.work, p = this.game.player.position;
    const vs = nm.villages.reduce((b, x) => (!b || Math.hypot(x.center.x - p.x, x.center.z - p.z) < Math.hypot(b.center.x - p.x, b.center.z - p.z) ? x : b), null);
    const stock = vs?.work ? [...vs.work.economy.stock].filter(([, n]) => n > 0).map(([id, n]) => `${id} ${n}`).join(' · ') : '';
    const ws = vs?.agents.filter((a) => a.state === 'WORKING' && a.job).length ?? 0;
    this.panel.innerHTML = `<b>Trabalho — ${vs?.village.config.name ?? ''}</b><br>${vs?.work?.buildings.length ?? 0} prédios · ${ws} trabalhando agora`
      + `<br>rotas ${w.stats.routes} (sem caminho ${w.stats.failedRoutes}, adiadas ${w.stats.deferred}, pior ${w.stats.maxRouteMs.toFixed(1)} ms)<br>estoque: ${stock}`;
  }
}
