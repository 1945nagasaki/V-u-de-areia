/**
 * Matemática de animação sem Three.js (regras puras, testáveis no Node).
 *
 * @example
 *   x = damp(x, alvo, 8, dt);                      // suave e independente do FPS
 *   const env = attackEnvelope(t, ANIMATION.attack.pounce);
 *   const { pitch, roll } = slopeTilt(groundAt, x, z, yaw, 1.2, 0.4);
 *   const { hip, knee } = twoBoneIK(0.44, 0.42, 0.8);
 */

/** Fator de amortecimento exponencial para `rate` (1/s) em `dt` s. */
export const dampFactor = (rate, dt) => 1 - Math.exp(-rate * dt);

/** Aproxima `cur` de `target` sem depender do framerate. */
export const damp = (cur, target, rate, dt) => cur + (target - cur) * dampFactor(rate, dt);

/** Como `damp`, mas para ângulos (sempre pelo caminho mais curto). */
export function dampAngle(cur, target, rate, dt) {
  const d = Math.atan2(Math.sin(target - cur), Math.cos(target - cur));
  return cur + d * dampFactor(rate, dt);
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Hermite 0→1 entre e0 e e1. */
export function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const easeOut = (t) => 1 - (1 - t) ** 3;
/** Passa um pouco do alvo e volta (impacto com "punch"). */
export const easeOutBack = (t, s = 1.6) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;

/** Parte fracionária positiva (fase em ciclos → [0, 1)). */
export const fract = (x) => x - Math.floor(x);

/**
 * Envelope de ataque em 3 fases.
 *  - antecipação: `wind` 0→1 (recua, encolhe, carrega o peso nas patas de trás)
 *  - impacto:     `wind` 1→0 e `lunge` 0→1 rápido (salta/projeta o tronco, boca abre)
 *  - recuperação: `lunge` 1→0 devagar (volta à postura de combate)
 * @param {number} t segundos desde o início do ataque
 * @param {{ anticipation: number, impact: number, recovery: number }} cfg
 * @returns {{ wind: number, lunge: number, phase: 'anticipation'|'impact'|'recovery'|'done', impactAt: number, total: number }}
 */
export function attackEnvelope(t, { anticipation, impact, recovery }) {
  const total = anticipation + impact + recovery;
  const impactAt = anticipation + impact * 0.5;
  if (t < 0) return { wind: 0, lunge: 0, phase: 'anticipation', impactAt, total };
  if (t < anticipation) return { wind: easeInOut(t / anticipation), lunge: 0, phase: 'anticipation', impactAt, total };
  if (t < anticipation + impact) {
    const u = (t - anticipation) / impact;
    return { wind: 1 - easeOut(u), lunge: Math.min(1.08, easeOutBack(u)), phase: 'impact', impactAt, total };
  }
  if (t < total) {
    const u = (t - anticipation - impact) / recovery;
    return { wind: 0, lunge: 1 - easeInOut(u), phase: 'recovery', impactAt, total };
  }
  return { wind: 0, lunge: 0, phase: 'done', impactAt, total };
}

/**
 * Inclinação do terreno sob um corpo de meio-comprimento `halfLen` e
 * meia-largura `halfWid`, virado para `yaw` (frente = (sin yaw, cos yaw)).
 * @param {(x: number, z: number) => number} groundAt
 * @returns {{ pitch: number, roll: number }} pitch > 0 = frente mais alta (subida);
 *   roll > 0 = lado +X local mais alto. Em radianos.
 */
export function slopeTilt(groundAt, x, z, yaw, halfLen, halfWid) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw); // +X local no mundo
  const hF = groundAt(x + fx * halfLen, z + fz * halfLen);
  const hB = groundAt(x - fx * halfLen, z - fz * halfLen);
  const hR = groundAt(x + rx * halfWid, z + rz * halfWid);
  const hL = groundAt(x - rx * halfWid, z - rz * halfWid);
  return {
    pitch: Math.atan2(hF - hB, 2 * halfLen),
    roll: Math.atan2(hR - hL, 2 * halfWid),
  };
}

/**
 * IK analítico de 2 ossos (coxa + canela) no plano da perna, alvo logo
 * abaixo do quadril a `dist` m.
 * @returns {{ hip: number, knee: number }} `hip`: quanto a coxa vai para a
 *   frente; `knee`: quanto o joelho dobra (0 = esticado). Radianos.
 */
export function twoBoneIK(l1, l2, dist) {
  const d = clamp(dist, Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4);
  const cosKnee = clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1);
  const cosHip = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  return { hip: Math.acos(cosHip), knee: Math.PI - Math.acos(cosKnee) };
}

/**
 * Ângulo de uma pata num ciclo de passada, com apoio linear (pata parada no
 * chão enquanto o corpo passa) e balanço suave (pata sobe e volta à frente).
 * @param {number} p fase da pata em ciclos [0, 1)
 * @param {number} duty fração do ciclo com a pata no chão
 * @returns {{ swing: number, lift: number }} swing ∈ [-1, 1] (+1 = pata à frente),
 *   lift ∈ [0, 1] (quanto o joelho dobra para levantar a pata)
 */
export function legCycle(p, duty) {
  if (p < duty) return { swing: 1 - 2 * (p / duty), lift: 0 };
  const u = (p - duty) / (1 - duty);
  return { swing: -Math.cos(u * Math.PI), lift: Math.sin(u * Math.PI) };
}

/**
 * Alcance vertical de uma perna de 2 ossos (quadril → pé), com a coxa girada `hip` rad a partir
 * da vertical e o joelho dobrado `knee` rad: é a altura a que o quadril fica do chão quando o pé
 * está apoiado. Perna esticada e a prumo = l1 + l2.
 * @example legReach(0.4, 0.4, 0, 0); // 0.8
 */
export function legReach(l1, l2, hip, knee) {
  return l1 * Math.cos(hip) + l2 * Math.cos(hip + knee);
}

/**
 * Altura do corpo ditada pelas patas APOIADAS: quanto o quadril desce em relação à perna
 * esticada (≤ 0). Vale a pata apoiada que alcança mais longe — assim nenhuma pata apoiada
 * atravessa o chão; as outras apoiadas ficam rente ou um pouco acima. Sem nenhuma pata no
 * chão (fase aérea do galope, salto) devolve 0: o corpo volta à altura da pose de repouso.
 * `rest` = altura do quadril na pose de repouso (padrão l1 + l2, perna a prumo). Modelos esculpidos
 * no meio de um passo têm pernas inclinadas no repouso: passe `rest` e some a inclinação em `hip` —
 * aí o resultado pode ser POSITIVO (a perna ficou mais a prumo que no repouso: o corpo sobe),
 * limitado a `maxRise` × rest.
 * @param {{ l1: number, l2: number, hip: number, knee: number, stance: boolean, rest?: number }[]} legs
 * @param {number} [maxRise] fração de `rest` que o corpo pode subir acima do repouso
 * @returns {number} deslocamento vertical do corpo (m)
 * @example
 *   contactDrop([{ l1: 0.4, l2: 0.4, hip: 0.5, knee: 0, stance: true }]); // ≈ −0.098
 */
export function contactDrop(legs, maxRise = 0.12) {
  let stance = -Infinity, swing = -Infinity, cap = 0;
  for (const l of legs) {
    const rest = l.rest ?? (l.l1 + l.l2);
    const d = legReach(l.l1, l.l2, l.hip, l.knee) - rest;
    cap = Math.max(cap, rest * maxRise);
    if (l.stance) stance = Math.max(stance, d); else swing = Math.max(swing, d);
  }
  // Patas apoiadas decidem a altura; uma pata NO AR que alcançaria mais longe que elas (esticada
  // para pousar ou acabando de sair do chão) também não pode furar o chão: o corpo sobe o que faltar.
  const base = stance === -Infinity ? 0 : stance;
  return Math.min(cap, Math.max(base, swing));
}

/** Respiração: 0→1→0 com inspiração um pouco mais curta que a expiração. */
export function breathWave(t, hz) {
  const p = fract(t * hz);
  return p < 0.4 ? easeInOut(p / 0.4) : 1 - easeInOut((p - 0.4) / 0.6);
}


/**
 * Passada sem deslize: escolhe o apoio (duty) e a amplitude do quadril para
 * que, durante o apoio, a pata recue no chão exatamente à velocidade do corpo
 * (2·amp·perna = v·duty/hz). Quando a amplitude bateria no limite do quadril,
 * o apoio encurta (como nos animais de verdade: quanto mais rápido, menos
 * tempo no chão e mais tempo no ar) em vez de a pata escorregar.
 * @param {number} v velocidade (m/s)
 * @param {number} legLen comprimento da perna (m)
 * @param {number} hz passadas por segundo
 * @param {number} duty apoio nominal da andadura (fração do ciclo)
 * @param {number} maxSwing amplitude máxima do quadril (rad)
 * @param {number} [minDuty] apoio mínimo (abaixo disto a pata desliza um pouco)
 * @returns {{ duty: number, amp: number }}
 * @example
 *   const { duty, amp } = stridePlan(9, 0.5, 2.6, 0.38, 0.62); // galope: duty ≈ 0,18
 */
export function stridePlan(v, legLen, hz, duty, maxSwing, minDuty = 0.14) {
  const span = 2 * hz * legLen; // m/s de chão por rad de amplitude, com duty = 1
  const need = (Math.max(v, 0) * duty) / span;
  if (need <= maxSwing) return { duty, amp: need };
  return { duty: clamp((maxSwing * span) / Math.max(v, 1e-6), minDuty, duty), amp: maxSwing };
}

/**
 * Maior intervalo do ciclo em que nenhuma pata está no chão (fase aérea).
 * @param {number[]} phases fase de cada pata (ciclos); a pata pousa quando fract(ph + fase) = 0
 * @param {number} duty fração do ciclo em apoio
 * @returns {{ center: number, length: number }} em ciclos; length = 0 se sempre há uma pata no chão
 * @example
 *   flightWindow([0, 0.58, 0.1, 0.68], 0.38); // galope: { center: 0.85, length: 0.1 }
 */
export function flightWindow(phases, duty) {
  const N = 200;
  let best = 0, bestStart = 0, run = 0, start = 0;
  for (let i = 0; i < N * 2; i++) {
    const ph = (i % N) / N;
    if (phases.every((o) => fract(ph + o) >= duty)) {
      if (!run) start = i;
      run++;
      if (run > best && run <= N) { best = run; bestStart = start; }
    } else run = 0;
  }
  return { center: fract((bestStart + best / 2) / N), length: Math.min(1, best / N) };
}

/**
 * Salto em 3 fases: antecipação (agacha, carrega as patas de trás) → voo
 * (impulso das traseiras, arco, patas esticadas, dianteiras buscam o chão) →
 * aterrissagem (as pernas amortecem e o corpo volta à postura).
 * @param {number} t segundos desde o início do salto
 * @param {{ anticipation: number, flight: number, landing: number }} cfg
 * @returns {{ phase: 'anticipation'|'flight'|'landing'|'done', crouch: number, air: number, arc: number, pitch: number, reach: number, total: number }}
 *   crouch 0..1 (agachamento), air 0..1 (peso da pose no ar), arc 0..1 (altura do arco),
 *   pitch −1..1 (+ = focinho para cima, na subida), reach 0..1 (dianteiras estendidas para o chão)
 * @example
 *   const j = jumpEnvelope(0.4, { anticipation: 0.18, flight: 0.6, landing: 0.3 }); // j.phase === 'flight'
 */
export function jumpEnvelope(t, { anticipation, flight, landing }) {
  const total = anticipation + flight + landing;
  const none = { crouch: 0, air: 0, arc: 0, pitch: 0, reach: 0, total };
  if (t < 0 || t >= total) return { phase: 'done', ...none };
  if (t < anticipation) return { phase: 'anticipation', ...none, crouch: easeInOut(t / anticipation) };
  if (t < anticipation + flight) {
    const u = (t - anticipation) / flight;
    return {
      phase: 'flight', total,
      crouch: Math.max(0, 1 - u * 5), // as patas esticam no impulso
      air: smoothstep(0, 0.2, u) * (1 - smoothstep(0.85, 1, u)),
      arc: Math.sin(u * Math.PI),
      pitch: Math.cos(u * Math.PI), // sobe de focinho para cima, desce de focinho para baixo
      reach: smoothstep(0.55, 0.95, u),
    };
  }
  const u = (t - anticipation - flight) / landing;
  // Amortece: afunda rápido (~25% do tempo) e sobe devagar.
  const sink = u < 0.25 ? easeOut(u / 0.25) : 1 - easeInOut((u - 0.25) / 0.75);
  // As dianteiras, que vinham estendidas para o chão, recolhem sob o corpo no primeiro terço.
  return { phase: 'landing', ...none, crouch: sink, reach: 1 - smoothstep(0, 0.35, u) };
}
