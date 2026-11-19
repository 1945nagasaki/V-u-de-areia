import RAPIER from '@dimforge/rapier3d-compat';
import { PHYSICS, PROP_TYPES } from '../config/physics.js';

let ready = null;
/**
 * Carrega o WebAssembly do Rapier. Chame (e espere) UMA vez antes de criar
 * um PhysicsWorld — o jogo faz isso no começo de `Game.init()`, antes do loop.
 * @returns {Promise<void>}
 * @example
 * await initPhysics();
 * const physics = new PhysicsWorld({ groundAt, collisions });
 */
export function initPhysics() {
  ready ??= RAPIER.init();
  return ready;
}

/** Quaternion de um giro `yaw` em Y seguido de `pitch` em X (ordem YXZ, como o resto do jogo). */
function yawPitch(yaw, pitch = 0) {
  const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2), cx = Math.cos(pitch / 2), sx = Math.sin(pitch / 2);
  return { x: cy * sx, y: sy * cx, z: -sy * sx, w: cy * cx };
}

/**
 * Acumulador de passo fixo: desacopla a simulação da taxa de quadros.
 * @param {number} acc tempo acumulado (s)
 * @param {number} dt tempo do quadro (s)
 * @param {{ step: number, maxFrame: number }} cfg
 * @returns {{ steps: number, acc: number }} quantos passos dar agora e o resto
 * @example
 * fixedSteps(0, 1 / 30, { step: 1 / 60, maxFrame: 0.25 }); // { steps: 2, acc: 0 }
 */
export function fixedSteps(acc, dt, { step, maxFrame }) {
  const t = acc + Math.min(Math.max(dt, 0), maxFrame); // aba sem foco: no máximo `maxFrame` de uma vez
  const steps = Math.floor(t / step + 1e-9);
  return { steps, acc: Math.max(0, t - steps * step) };
}

/**
 * Mundo de física (Rapier), transmitido em volta do jogador. Escala real:
 * 1 unidade = 1 metro, gravidade −9,81 m/s², passo fixo de 1/60 s.
 *
 * - Terreno: um heightfield de `2 × radius` metros refeito quando o jogador
 *   anda `rebuildDistance` m (o continente inteiro em física seria pesado).
 * - Estáticos (`RigidBodyDesc.fixed`): cada colisor do CollisionWorld (paredes
 *   de casas, muros, cercas, rochas, poços, troncos…) e cada superfície andável
 *   (plataformas, pontes, palafitas) vira um corpo fixo enquanto estiver no raio.
 *   Os colisores gerados por `applyWorldPhysics` (WorldColliders.js) entram
 *   num raio menor (`PHYSICS.staticRadius`): são milhares de peças pequenas.
 * - Dinâmicos: barris, caixotes, tábuas, toras, sacos, lanternas, galhos
 *   (`props`) com massa, atrito, elasticidade, resistência do ar e CCD (não
 *   atravessam paredes nem quando arremessados); dormem quando param. Só se
 *   movem por impulso/velocidade — ninguém escreve na posição deles.
 * - Jogador e animais: cápsula/cilindro CINEMÁTICOS (com CCD) que seguem o
 *   controle do personagem e empurram os objetos; o soco aplica um impulso.
 *
 * O controle do personagem continua no CollisionWorld (paredes 2D + chão
 * por altura): é ele que impede o jogador de atravessar paredes. A física
 * cuida de como os OBJETOS reagem.
 *
 * @example
 * await initPhysics();
 * const physics = new PhysicsWorld({ groundAt: (x, z) => terrain.heightAt(x, z), collisions, surfaces });
 * physics.addProp('barrel', { x, y, z });
 * // no loop:
 * physics.update(dt, player.position);   // transmite, simula em passos fixos
 * propMeshes.sync(physics.props);         // copia posição/rotação para os InstancedMesh
 */
export class PhysicsWorld {
  /** Longe do mapa: onde ficam os props do estoque (peças de carcaça) fora de uso. */
  static POOL = { x: 100000, y: -1000, z: 100000 };

  /**
   * @param {object} o
   * @param {(x:number, z:number) => number} o.groundAt altura do terreno
   * @param {import('../world/CollisionWorld.js').CollisionWorld} o.collisions
   * @param {import('../world/Surfaces.js').Surfaces} [o.surfaces]
   */
  constructor({ groundAt, collisions, surfaces = null }) {
    this.groundAt = groundAt;
    this.collisions = collisions;
    this.surfaces = surfaces;
    const world = new RAPIER.World({ x: 0, y: PHYSICS.gravity, z: 0 });
    world.timestep = PHYSICS.step;
    this.world = world;
    this.acc = 0;

    /** Objetos dinâmicos: { type, index, pos, quat, scale, body, active, moved } */
    this.props = [];
    this.byType = new Map();
    this.statics = new Map(); // colisor/superfície → corpo fixo
    this.focus = null;
    this.heightfield = null;

    // Jogador: cápsula cinemática (segue o controle; empurra os objetos).
    const P = PHYSICS.player;
    this.player = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setCcdEnabled(true));
    world.createCollider(RAPIER.ColliderDesc.capsule(Math.max(0.01, P.height / 2 - P.radius), P.radius).setFriction(PHYSICS.friction), this.player);
    this._last = null;
  }

  /** Atrito e elasticidade padrão num colisor. */
  material(desc) {
    return desc.setFriction(PHYSICS.friction).setRestitution(PHYSICS.restitution);
  }

  /**
   * Registra um objeto dinâmico (ainda sem corpo: ele nasce quando o
   * jogador chega perto).
   * @param {keyof typeof PROP_TYPES} type
   * @param {{x:number, y?:number, z:number, rot?:number, scale?:number}} o
   *   y = base do objeto (padrão: chão); rot = giro em Y
   * @returns {object} o registro do objeto
   */
  addProp(type, { x, y, z, rot = 0, scale = 1 }) {
    const def = PROP_TYPES[type];
    if (!def) throw new Error(`Objeto desconhecido: ${type}`);
    const half = def.shape.type === 'box' ? def.shape.half[1] : def.shape.h / 2;
    const base = y ?? this.groundAt(x, z);
    const list = this.byType.get(type) ?? [];
    this.byType.set(type, list);
    const p = {
      type, index: list.length, scale,
      pos: { x, y: base + half * scale + 0.01, z },
      quat: { x: 0, y: Math.sin(rot / 2), z: 0, w: Math.cos(rot / 2) },
      body: null, active: false, moved: true,
    };
    list.push(p);
    this.props.push(p);
    return p;
  }

  /**
   * Cria o corpo dinâmico de um objeto (cada vez que entra no raio): massa,
   * atrito, elasticidade, resistência do ar e CCD.
   */
  makeBody(p) {
    const def = PROP_TYPES[p.type], s = p.scale, D = PHYSICS.dynamic;
    const shape = def.shape.type === 'box'
      ? RAPIER.ColliderDesc.cuboid(def.shape.half[0] * s, def.shape.half[1] * s, def.shape.half[2] * s)
      : RAPIER.ColliderDesc.cylinder((def.shape.h * s) / 2, def.shape.r * s);
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(p.pos.x, p.pos.y, p.pos.z)
      .setRotation(p.quat)
      .setLinearDamping(D.linearDamping)
      .setAngularDamping(D.angularDamping)
      .setCcdEnabled(D.ccd)
      .setCanSleep(true));
    this.world.createCollider(this.material(shape).setMass(def.mass * s * s * s), body);
    body.userData = p;
    p.body = body;
    return body;
  }

  /** Tira o corpo do mundo (o registro guarda posição e rotação; o corpo renasce ao voltar). */
  dropBody(p) {
    if (p.body) this.world.removeRigidBody(p.body);
    p.body = null;
    p.active = false;
  }

  // ------------------------------------------------------------ transmissão

  /** Refaz o terreno, os estáticos e os objetos ativos em volta de `pos`. */
  stream(pos) {
    this.focus = { x: pos.x, z: pos.z };
    this.buildHeightfield(pos);
    const R = PHYSICS.radius, R2 = (R + 8) ** 2;
    const near = (x, z, r = 0) => (x - pos.x) ** 2 + (z - pos.z) ** 2 < (R + r) ** 2;

    // Estáticos: entra o que está no raio, sai o que ficou longe.
    const want = new Set();
    // Colisores automáticos (WorldColliders) são muitos e pequenos: só no raio menor `staticRadius`.
    const S = PHYSICS.staticRadius;
    const nearAuto = (c) => (c.x - pos.x) ** 2 + (c.z - pos.z) ** 2 < (S + (c.r ?? Math.hypot(c.hw, c.hd))) ** 2;
    for (const c of this.collisions.all) {
      if (c.enabled === false) continue;
      if (c.auto ? nearAuto(c) : near(c.x, c.z, c.r ?? Math.hypot(c.hw, c.hd))) want.add(c);
    }
    if (this.surfaces) {
      for (const s of this.surfaces.all) {
        const cx = s.type === 'segment' ? (s.ax + s.bx) / 2 : s.x, cz = s.type === 'segment' ? (s.az + s.bz) / 2 : s.z;
        if (near(cx, cz, s.r ?? Math.hypot(s.bx - s.ax, s.bz - s.az) / 2 + 2)) want.add(s);
      }
    }
    for (const [key, body] of this.statics) if (!want.has(key)) { this.world.removeRigidBody(body); this.statics.delete(key); }
    for (const key of want) if (!this.statics.has(key)) this.statics.set(key, this.addStatic(key));

    // Objetos: ativa no raio; congela (tira do mundo) os que ficaram longe.
    for (const p of this.props) {
      const inside = (p.pos.x - pos.x) ** 2 + (p.pos.z - pos.z) ** 2 < (p.active ? R2 : R * R);
      if (inside && !p.active) {
        this.makeBody(p).sleep(); // nasce parado: acorda quando algo encosta
        p.active = true;
      } else if (!inside && p.active) this.dropBody(p);
    }
  }

  /** Terreno físico: heightfield (corpo fixo) em volta do jogador. */
  buildHeightfield(pos) {
    if (this.heightfield) this.world.removeRigidBody(this.heightfield);
    const es = PHYSICS.heightfieldStep, L = PHYSICS.radius * 2 + 8;
    const n = Math.ceil(L / es) + 1, side = (n - 1) * es;
    const x0 = Math.round((pos.x - L / 2) / es) * es, z0 = Math.round((pos.z - L / 2) / es) * es;
    // Matriz n × n do Rapier (ordem de coluna): a COLUNA i corre em X e a linha j em Z
    // (conferido por raio em rapier-world.test.js — trocar os eixos espelha o relevo na diagonal).
    const heights = new Float32Array(n * n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) heights[i * n + j] = this.groundAt(x0 + i * es, z0 + j * es);
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x0 + side / 2, 0, z0 + side / 2));
    this.world.createCollider(this.material(RAPIER.ColliderDesc.heightfield(n - 1, n - 1, heights, { x: side, y: 1, z: side })), body);
    this.heightfield = body;
  }

  /** Corpo fixo para um colisor 2D (com altura) ou uma superfície andável. */
  addStatic(c) {
    let shape, pos, rot = null;
    if (c.type === 'circle' || c.type === 'box' && c.hw !== undefined && c.y === undefined) {
      const g = this.groundAt(c.x, c.z);
      const y0 = c.y0 ?? g - 1, y1 = c.y1 ?? g + PHYSICS.staticHeight;
      const h = Math.max(0.2, y1 - y0);
      shape = c.type === 'circle' ? RAPIER.ColliderDesc.cylinder(h / 2, c.r) : RAPIER.ColliderDesc.cuboid(c.hw, h / 2, c.hd);
      pos = [c.x, (y0 + y1) / 2, c.z];
      if (c.type === 'box') rot = yawPitch(Math.atan2(c.sin, c.cos));
    } else if (c.type === 'disc') {
      shape = RAPIER.ColliderDesc.cylinder(0.1, c.r);
      pos = [c.x, c.y - 0.1, c.z];
    } else if (c.type === 'segment') { // rampa/ponte inclinada
      const len = Math.hypot(c.bx - c.ax, c.bz - c.az);
      shape = RAPIER.ColliderDesc.cuboid(c.width / 2, 0.1, len / 2);
      pos = [(c.ax + c.bx) / 2, (c.y0 + c.y1) / 2 - 0.1, (c.az + c.bz) / 2];
      rot = yawPitch(Math.atan2(c.bx - c.ax, c.bz - c.az), -Math.atan2(c.y1 - c.y0, len));
    } else { // superfície 'box'
      shape = RAPIER.ColliderDesc.cuboid(c.hw, 0.1, c.hd);
      pos = [c.x, c.y - 0.1, c.z];
      rot = yawPitch(Math.atan2(c.sin, c.cos));
    }
    const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(pos[0], pos[1], pos[2]);
    if (rot) desc.setRotation(rot);
    const body = this.world.createRigidBody(desc);
    this.world.createCollider(this.material(shape), body);
    return body;
  }

  /**
   * Solta um objeto do estoque em (x, y, z) com um empurrão: nasce ativo e acordado.
   * @param {object} p registro de addProp
   * @param {{x:number, y:number, z:number}} at
   * @param {{x:number, y:number, z:number}} [vel]
   */
  placeProp(p, { x, y, z }, vel = null) {
    p.pos.x = x; p.pos.y = y; p.pos.z = z;
    const b = p.body ?? this.makeBody(p);
    b.setTranslation({ x, y, z }, true);
    b.setLinvel({ x: vel?.x ?? 0, y: vel?.y ?? 0, z: vel?.z ?? 0 }, true); // arremesso = velocidade inicial
    b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    b.wakeUp();
    p.active = true;
    p.moved = true;
  }

  /** Guarda de volta no estoque (pegou do chão): sai do mundo e vai para longe. */
  storeProp(p) {
    this.dropBody(p);
    p.pos.x = PhysicsWorld.POOL.x; p.pos.y = PhysicsWorld.POOL.y; p.pos.z = PhysicsWorld.POOL.z;
    p.moved = true;
  }

  // ------------------------------------------------------------ agentes (animais)

  /**
   * Corpo cinemático de um animal: segue a IA e empurra os objetos dinâmicos
   * (um javali correndo derruba barris). Não é empurrado de volta.
   * @returns {import('@dimforge/rapier3d-compat').RigidBody}
   */
  addAgent({ x, y, z, radius, height }) {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y + height / 2, z).setCcdEnabled(true));
    this.world.createCollider(RAPIER.ColliderDesc.cylinder(height / 2, radius).setFriction(PHYSICS.friction), body);
    body.userData = { height, last: null };
    return body;
  }

  /**
   * Leva um corpo cinemático até (x, y, z). O Rapier tira a velocidade do
   * deslocamento → o contato empurra o que tocar. Acima de `maxSpeed` é
   * teleporte: o corpo só aparece lá, sem varrer o caminho.
   */
  follow(body, last, x, y, z, dt, maxSpeed) {
    const jump = !last || dt <= 0 || Math.hypot(x - last.x, y - last.y, z - last.z) / dt > maxSpeed;
    if (jump) body.setTranslation({ x, y, z }, true);
    else body.setNextKinematicTranslation({ x, y, z });
  }

  /** Move o corpo do animal (pés em x, y, z). */
  moveAgent(body, x, y, z, dt) {
    const cy = y + body.userData.height / 2;
    this.follow(body, body.userData.last, x, cy, z, dt, 40);
    body.userData.last = { x, y: cy, z };
  }

  removeAgent(body) {
    this.world.removeRigidBody(body);
  }

  // ------------------------------------------------------------ simulação

  /**
   * Um quadro: transmite se o jogador andou, leva o corpo do jogador
   * (cinemático: empurra os objetos), avança a simulação em passos FIXOS de
   * `PHYSICS.step` (acumulador; no máximo `PHYSICS.maxFrame` s por quadro) e
   * copia posição e rotação de cada corpo acordado para o registro que as
   * malhas leem (`PropMeshes.sync`).
   * @param {number} dt tempo do quadro (s) — qualquer taxa de quadros
   * @param {{x:number, y:number, z:number}} player posição dos pés
   * @returns {number} passos de simulação dados neste quadro
   */
  update(dt, player) {
    if (!this.focus || Math.hypot(player.x - this.focus.x, player.z - this.focus.z) > PHYSICS.rebuildDistance) this.stream(player);
    const cy = player.y + PHYSICS.player.height / 2 + 0.05;
    this.follow(this.player, this._last, player.x, cy, player.z, dt, 60);
    this._last = { x: player.x, y: cy, z: player.z };
    const { steps, acc } = fixedSteps(this.acc, dt, PHYSICS);
    this.acc = acc;
    for (let i = 0; i < steps; i++) this.world.step();
    if (!steps) return 0;
    for (const p of this.props) {
      if (!p.active || p.body.isSleeping()) continue;
      const q = p.body.translation(), r = p.body.rotation();
      if (q.y < -60) { // caiu do mundo
        p.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        p.body.setTranslation({ x: q.x, y: this.groundAt(q.x, q.z) + 1, z: q.z }, true);
        q.y = this.groundAt(q.x, q.z) + 1;
      }
      p.pos.x = q.x; p.pos.y = q.y; p.pos.z = q.z;
      p.quat.x = r.x; p.quat.y = r.y; p.quat.z = r.z; p.quat.w = r.w;
      p.moved = true;
    }
    return steps;
  }

  /**
   * Soco: o objeto ativo mais perto na direção do golpe recebe um impulso.
   * @param {{x,y,z}} origin de onde sai o soco
   * @param {{x,y,z}} dir direção (unitária)
   * @returns {object|null} o objeto atingido
   */
  punch(origin, dir) {
    const { punchRange, punchForce, punchLift } = PHYSICS.player;
    let best = null, bestT = Infinity;
    for (const p of this.props) {
      if (!p.active) continue;
      const dx = p.pos.x - origin.x, dy = p.pos.y - origin.y, dz = p.pos.z - origin.z;
      const t = dx * dir.x + dy * dir.y + dz * dir.z;
      if (t < 0 || t > punchRange + 0.6 * p.scale) continue;
      const off = Math.hypot(dx - dir.x * t, dy - dir.y * t, dz - dir.z * t);
      if (off < 0.7 * p.scale + 0.25 && t < bestT) { best = p; bestT = t; }
    }
    if (!best) return null;
    const b = best.body, c = b.translation();
    const f = punchForce * Math.min(2, b.mass() / 10 + 0.4);
    // Acerta acima do centro → o objeto tomba/rola em vez de só deslizar.
    // (Rapier: o ponto é em coordenadas do MUNDO.)
    b.applyImpulseAtPoint({ x: dir.x * f, y: (dir.y + punchLift) * f, z: dir.z * f },
      { x: c.x - dir.x * 0.2, y: c.y + 0.25 * best.scale, z: c.z - dir.z * 0.2 }, true);
    return best;
  }
}
