import * as THREE from 'three';
import { gripOf, POSES, ANIM } from '../../config/gearGrips.js';
import { GEAR_CATALOG } from '../../config/gear.js';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const D = 1, S = 0; // Humanoid.arms: dominante (o do soco) e apoio

/**
 * Item na mão do personagem: prende o modelo no osso da mão (3ª pessoa) e num
 * suporte preso à câmera (1ª pessoa), e anima equipar, guardar, repouso,
 * golpe, disparo (recuo), recarga (carregador sai e volta, ferrolho), arco
 * (corda e flecha) e comer/beber (mão à boca).
 *
 * Só desenha: quem decide o que está acontecendo é o `GearController`, que
 * passa o progresso de cada ação em `update`. Um item por vez: trocar remove
 * o anterior (nunca há dois itens na mesma mão).
 *
 * @example
 * const held = new HeldItem({ models, humanoid: player.model, camera });
 * held.set('pistola');
 * held.kick();                                    // recuo de um tiro
 * held.update(dt, { reload: 0.4, pitch: 0.1, firstPerson: false });
 */
export class HeldItem {
  /**
   * @param {{ models: import('./GearModels.js').GearModels, humanoid: object, camera: THREE.Camera, catalog?: object }} o
   */
  constructor({ models, humanoid, camera, catalog = GEAR_CATALOG }) {
    this.models = models;
    this.h = humanoid;
    this.catalog = catalog;
    this.id = null;
    this.grip = null;
    this.tp = null; // modelo na mão (3ª pessoa)
    this.fpItem = null; // modelo na câmera (1ª pessoa)
    this.fp = new THREE.Group();
    this.fp.name = 'first-person-item';
    this.fp.visible = false;
    camera.add(this.fp);
    // antebraço e punho simples que seguram o item em 1ª pessoa
    const skin = new THREE.MeshStandardMaterial({ color: 0x6b4430, roughness: 0.6 });
    const sleeve = new THREE.MeshStandardMaterial({ color: 0xc8a050, roughness: 0.85 });
    this.fpArm = new THREE.Group();
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.3, 4, 8).rotateX(Math.PI / 2), sleeve);
    fore.position.set(0.045, -0.11, 0.2);
    fore.rotation.set(0.35, -0.2, 0);
    const fist = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.055), skin);
    fist.position.set(0.006, -0.04, 0.0);
    this.fpArm.add(fore, fist);
    for (const m of [fore, fist]) m.frustumCulled = false;
    this.fp.add(this.fpArm);
    this.w = 0; // 0..1: quanto a pose do item vale (equipar/guardar)
    this.pending = undefined; // id esperando o item atual terminar de ser guardado
    this.recoil = 0;
    this.t = 0;
    this._pose = { D: [0, 0, 0], S: [0, 0, 0], hasD: false, hasS: false, torso: 0, lean: 0, head: 0 };
    this._e = new THREE.Euler();
  }

  /**
   * Troca o item na mão (`null` = guarda). A troca passa pela animação de
   * guardar o anterior e equipar o novo.
   */
  set(id) {
    if (this.pending !== undefined) { this.pending = id === this.id ? undefined : id; return; } // já guardando: muda o destino
    if (id === this.id) return;
    if (this.id === null) { this.attach(id); return; }
    this.pending = id; // guarda primeiro; `update` equipa o novo
  }

  attach(id) {
    this.detach();
    this.id = id;
    if (id === null) return;
    const def = this.catalog[id];
    const g = (this.grip = gripOf(def));
    this.tp = this.models.create(id);
    this.tp.position.fromArray(g.pos);
    this.tp.rotation.fromArray(g.rot);
    this.tp.scale.setScalar(g.scale);
    this.h.hands[g.hand === 'S' ? S : D].add(this.tp);
    this.fpItem = this.models.create(id);
    this.fpItem.traverse((o) => { o.frustumCulled = false; if (o.isMesh) o.castShadow = false; });
    this.fp.add(this.fpItem);
    this.fpArm.visible = g.pose !== 'bow';
    this.w = 0;
    this.recoil = 0;
  }

  detach() {
    this.tp?.removeFromParent();
    this.fpItem?.removeFromParent();
    this.tp = this.fpItem = null;
    this.id = null;
    this.grip = null;
  }

  /** Recuo de um disparo (armas de fogo) ou soltar da corda (arco). */
  kick(strength = 1) {
    this.recoil = strength;
  }

  /**
   * Um quadro. Chamar DEPOIS de `humanoid.update` (a pose do item entra por cima).
   * @param {number} dt
   * @param {{ swing?: number|null, reload?: number|null, draw?: number|null, consume?: number|null, drink?: boolean,
   *   pitch?: number, firstPerson?: boolean, visible?: boolean }} a progresso 0..1 de cada ação (null = não está acontecendo)
   */
  update(dt, { swing = null, reload = null, draw = null, consume = null, pitch = 0, firstPerson = false, visible = true } = {}) {
    this.t += dt;
    if (this.pending !== undefined) {
      this.w = Math.max(0, this.w - dt / ANIM.holsterSeconds);
      if (this.w <= 0) { const next = this.pending; this.pending = undefined; this.attach(next); }
    } else if (this.id !== null) this.w = Math.min(1, this.w + dt / ANIM.equipSeconds);
    this.recoil = Math.max(0, this.recoil - dt / ANIM.recoilSeconds);
    this.fp.visible = firstPerson && visible && this.id !== null;
    if (this.id === null) return;

    const g = this.grip, w = ease(this.w);
    const set = POSES[g.pose] ?? POSES.carry;
    const P = this._pose;
    P.torso = P.lean = P.head = 0;
    this.blend(P, set.idle, set.idle, 0);
    let aim = !!set.idle.aim, swingK = 0, strikeK = 0, mouthK = 0;

    if (swing !== null && set.wind) {
      // preparo → golpe → volta ao repouso
      if (swing < ANIM.swingWind) { swingK = ease(swing / ANIM.swingWind); this.blend(P, set.idle, set.wind, swingK); }
      else if (swing < ANIM.swingStrike) { strikeK = ease((swing - ANIM.swingWind) / (ANIM.swingStrike - ANIM.swingWind)); swingK = 1 - strikeK; this.blend(P, set.wind, set.strike, strikeK); }
      else { strikeK = 1 - ease((swing - ANIM.swingStrike) / (1 - ANIM.swingStrike)); this.blend(P, set.idle, set.strike, strikeK); }
    }
    let magOut = 0, magHidden = false, rack = 0, lower = 0;
    if (reload !== null && set.reload) {
      const R = ANIM.reload;
      lower = reload < R.lower ? ease(reload / R.lower) : reload > R.rack ? 1 - ease((reload - R.rack) / (1 - R.rack)) : 1;
      this.blend(P, set.idle, set.reload, lower);
      aim = false;
      if (reload >= R.lower && reload < R.magIn) {
        // mão de apoio tira o carregador, desce para buscar outro e volta
        const k = reload < R.magOut ? 0 : reload < R.fetch ? ease((reload - R.magOut) / (R.fetch - R.magOut)) : 1 - ease((reload - R.fetch) / (R.magIn - R.fetch));
        this.blend(P, set.reload, set.fetch, k);
        magOut = reload < R.magOut ? ease((reload - R.lower) / (R.magOut - R.lower)) : reload < R.fetch ? 1 : 1 - ease((reload - R.fetch) / (R.magIn - R.fetch));
        magHidden = reload >= R.magOut && reload < R.fetch;
      }
      if (reload >= R.magIn && reload < R.rack) rack = Math.sin(((reload - R.magIn) / (R.rack - R.magIn)) * Math.PI);
    }
    if (draw !== null && set.nock) { this.blend(P, set.nock, set.full, ease(draw)); aim = true; }
    else if (g.pose === 'bow') aim = false;
    if (consume !== null) {
      mouthK = consume < ANIM.mouthAt ? ease(consume / ANIM.mouthAt) : consume > 0.9 ? 1 - ease((consume - 0.9) / 0.1) : 1;
      const bob = mouthK >= 1 ? Math.sin(this.t * 9) * 0.04 : 0;
      this.blend(P, set.idle, POSES.mouth, mouthK);
      P.D[2] += bob;
      P.head = (POSES.mouth.head ?? 0) * mouthK * (g.drinkTilt ? 2.2 : 1);
    }

    // ---- 3ª pessoa: braços, tronco e cabeça por cima da animação do corpo
    const h = this.h, aimPitch = aim ? pitch : 0;
    if (P.hasD) this.arm(D, P.D, w, aimPitch - this.recoil * 0.22);
    if (P.hasS) this.arm(S, P.S, w, aimPitch - (g.pose === 'rifle' ? this.recoil * 0.12 : 0));
    if (P.torso) h.torso.rotation.y += P.torso * w;
    if (P.lean) h.torso.rotation.x += P.lean * w;
    if (P.head) h.head.rotation.x += P.head * w;
    // beber: inclina o recipiente para a boca
    if (this.tp && g.drinkTilt) this.tp.rotation.x = g.rot[0] - g.drinkTilt * (consume !== null && mouthK >= 1 ? 1 : 0) * 0.6;

    for (const m of [this.tp, this.fpItem]) if (m) this.animateParts(m, { magOut, magHidden, rack, draw });

    // ---- 1ª pessoa: o item preso à câmera
    if (this.fp.visible) {
      const f = g.fp, it = this.fpItem;
      let x = f.pos[0], y = f.pos[1] - (1 - w) * 0.35, z = f.pos[2];
      let rx = f.rot[0], ry = f.rot[1], rz = f.rot[2];
      const sway = Math.sin(this.t * 1.6) * 0.004;
      y += sway;
      rx += -0.75 * swingK + 0.95 * strikeK; z -= 0.12 * strikeK; y += 0.1 * swingK - 0.08 * strikeK;
      z += 0.05 * this.recoil; rx += 0.12 * this.recoil; y += 0.012 * this.recoil;
      y -= 0.07 * lower; rz += 0.45 * lower; x -= 0.03 * lower;
      if (draw !== null) { x += 0.03 * draw; }
      if (mouthK) { x = lerp(x, 0.03, mouthK); y = lerp(y, -0.13, mouthK); z = lerp(z, -0.27, mouthK); rx += (g.drinkTilt ? -g.drinkTilt * 0.7 : 0.25) * mouthK; }
      it.position.set(x, y, z);
      it.rotation.set(rx, ry, rz);
      it.scale.setScalar(f.scale);
      this.fpArm.position.set(x, y, z);
      this.fpArm.rotation.set(0, 0, rz * 0.5);
    }
  }

  /** Mistura duas poses nomeadas em `out`. */
  blend(out, a, b, t) {
    for (const k of ['D', 'S']) {
      const pa = a[k] ?? b[k], pb = b[k] ?? a[k];
      out[k === 'D' ? 'hasD' : 'hasS'] = !!pa;
      if (!pa) continue;
      for (let i = 0; i < 3; i++) out[k][i] = lerp(pa[i], pb[i], t);
    }
    out.torso = lerp(a.torso ?? 0, b.torso ?? 0, t);
    out.lean = lerp(a.lean ?? 0, b.lean ?? 0, t);
  }

  /** Aplica `[ombroX, ombroZ, cotovelo]` num braço, com peso `w` sobre a animação do corpo. */
  arm(i, p, w, pitchOffset) {
    const a = this.h.arms[i], e = this.h.elbows[i], hand = this.h.hands[i];
    a.rotation.x = lerp(a.rotation.x, p[0] - pitchOffset, w);
    a.rotation.y = lerp(a.rotation.y, 0, w);
    a.rotation.z = lerp(a.rotation.z, p[1], w);
    e.rotation.x = lerp(e.rotation.x, p[2], w);
    hand.rotation.set(lerp(hand.rotation.x, 0, w), 0, lerp(hand.rotation.z, 0, w));
  }

  /** Peças móveis do modelo: carregador, ferrolho, corda e flecha do arco. */
  animateParts(m, { magOut, magHidden, rack, draw }) {
    const parts = m.userData.parts;
    if (!parts) return;
    if (parts.magazine) {
      parts.magazine.position.y = -ANIM.magazineDrop * magOut;
      parts.magazine.visible = !magHidden;
    }
    if (parts.slide) parts.slide.position.z = -ANIM.slideTravel * Math.max(rack, this.recoil);
    if (parts.string) {
      const rest = parts.string.userData.rest, pull = rest + ANIM.bowDrawMeters * (draw ?? 0);
      const pos = parts.string.geometry.attributes.position;
      if (pos.getY(1) !== pull) { pos.setY(1, pull); pos.needsUpdate = true; }
      if (parts.arrow) {
        parts.arrow.visible = draw !== null;
        parts.arrow.position.y = pull - 0.36; // rabo da flecha na corda
      }
    }
  }
}
