import * as THREE from 'three';
import { SPECIES_LOOT, MEAT_LOOT, MEATS } from '../../config/foods.js';
import { ITEMS } from '../PlayerState.js';
import { foodShortLine } from '../../ui/FoodCard.js';

/**
 * Carne por espécie no chão: quando um animal morre, a carne DA ESPÉCIE dele
 * (SPECIES_LOOT) aparece onde ele caiu, com um anel de realce pulsando e o
 * aviso "[E] Coletar". Um único interagível segue a carne mais perto (barato
 * mesmo com muitas no chão).
 *
 * @example
 *   const loot = new MeatLoot(game, { sounds });
 *   loot.drop(animal);      // ao morrer
 *   loot.update(dt);        // no loop: pulso, sumiço, aviso de coleta
 */
export class MeatLoot {
  /** @param {object} game @param {{ sounds?: import('../../audio/FoodSounds.js').FoodSounds }} deps */
  constructor(game, { sounds = null } = {}) {
    this.game = game;
    this.sounds = sounds;
    /** @type {{ id: string, n: number, root: THREE.Group, ring: THREE.Mesh, age: number, pos: THREE.Vector3 }[]} */
    this.drops = [];
    this.nearest = null;
    this.geo = {
      meat: new THREE.SphereGeometry(0.22, 10, 7),
      bone: new THREE.CylinderGeometry(0.035, 0.035, 0.42, 6),
      ring: new THREE.RingGeometry(0.42, 0.52, 28),
    };
    this.mats = {};
    this.boneMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 0.7 });
    this.ringMat = new THREE.MeshBasicMaterial({ color: MEAT_LOOT.highlight.color, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const self = this;
    this.prompt = game.interactions.register({
      id: 'meat-loot', label: 'Coletar', radius: MEAT_LOOT.pickupRadius,
      position: () => self.nearest?.pos ?? game.constructor.NOWHERE ?? FAR,
      onInteract: () => self.pick(self.nearest),
    });
  }

  /** Material da carne (um por tipo, reaproveitado). */
  matFor(id) {
    if (!this.mats[id]) this.mats[id] = new THREE.MeshStandardMaterial({ color: MEATS[id]?.color ?? 0x9a3030, roughness: 0.55, emissive: 0x220000 });
    return this.mats[id];
  }

  /**
   * Larga a carne da espécie do animal. Sem entrada na tabela, nada cai.
   * @param {{ speciesId: string, position: THREE.Vector3, root?: THREE.Object3D }} animal
   * @returns {boolean}
   */
  drop(animal) {
    const l = SPECIES_LOOT[animal.speciesId];
    if (!l || this.game.areaId !== 'overworld') return false;
    const p = animal.root?.position ?? animal.position;
    const ang = this.game.random() * Math.PI * 2;
    const x = p.x + Math.cos(ang) * 0.9, z = p.z + Math.sin(ang) * 0.9;
    const y = this.game.groundHeight(x, z);
    const root = new THREE.Group();
    root.position.set(x, y, z);
    const meat = new THREE.Mesh(this.geo.meat, this.matFor(l.meat));
    meat.scale.set(1.2, 0.45, 0.85); meat.position.y = 0.11; meat.castShadow = true;
    const bone = new THREE.Mesh(this.geo.bone, this.boneMat);
    bone.rotation.z = Math.PI / 2; bone.position.set(0.12, 0.13, 0);
    const ring = new THREE.Mesh(this.geo.ring, this.ringMat);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
    root.add(meat, bone, ring);
    root.rotation.y = ang;
    this.game.scene.add(root);
    this.drops.push({ id: l.meat, n: l.amount, root, ring, age: 0, pos: root.position });
    return true;
  }

  /** Coleta uma carne do chão. */
  pick(d) {
    if (!d) return;
    const g = this.game;
    g.state.addItem(d.id, d.n);
    const cam = g.camera.position, yaw = g.cameraRig?.yaw ?? 0;
    const dx = d.pos.x - cam.x, dz = d.pos.z - cam.z, dist = Math.hypot(dx, dz) || 1;
    this.sounds?.pickup((dx * Math.cos(yaw) - dz * Math.sin(yaw)) / dist);
    g.ui.toast(`+${d.n} ${ITEMS[d.id].name} · ${foodShortLine(ITEMS[d.id])}`);
    this.removeDrop(d);
  }

  removeDrop(d) {
    this.game.scene.remove(d.root);
    const i = this.drops.indexOf(d);
    if (i >= 0) this.drops.splice(i, 1);
    if (this.nearest === d) this.nearest = null;
  }

  update(dt) {
    const g = this.game, pos = g.player.position, H = MEAT_LOOT.highlight;
    let best = null, bd = Infinity;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      if (d.age > MEAT_LOOT.despawnSeconds) { this.removeDrop(d); continue; }
      const s = 1 + 0.12 * Math.sin(g.time * H.pulse * Math.PI);
      d.ring.scale.set(s, s, s);
      const dist = Math.hypot(d.pos.x - pos.x, d.pos.z - pos.z);
      if (dist < bd) { bd = dist; best = d; }
    }
    this.ringMat.opacity = 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(g.time * H.pulse * Math.PI));
    if (best !== this.nearest) {
      this.nearest = best;
      if (best) this.prompt.label = `Coletar ${ITEMS[best.id].name}${best.n > 1 ? ` ×${best.n}` : ''} (${foodShortLine(ITEMS[best.id])})`;
    }
    this.prompt.enabled = !!best && g.areaId === 'overworld';
  }
}

const FAR = new THREE.Vector3(0, -1e6, 0);
