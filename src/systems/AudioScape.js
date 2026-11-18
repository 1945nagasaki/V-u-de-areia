import * as THREE from 'three';

/**
 * Som ambiente sintetizado com WebAudio (sem arquivos):
 *  - chuva (ruído branco filtrado), trovões (ruído grave em rajada),
 *  - vento do deserto (ruído em banda com variação lenta),
 *  - fogueira espacial (estalos + chiado num PannerNode).
 *
 * O navegador só libera áudio depois de um gesto: `unlock()` no primeiro
 * clique/tecla. Sem WebAudio, tudo vira no-op.
 */
export class AudioScape {
  constructor() {
    this.ctx = null;
    this.storm = 1;
    this.fires = [];
  }

  /** Cria o contexto (chame num gesto do usuário). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(ctx.destination);
    this.noise = makeNoise(ctx);

    this.rain = this.loop(this.noise, [['highpass', 900], ['lowpass', 7000]], 0);
    this.wind = this.loop(this.noise, [['bandpass', 420, 0.7]], 0);
    this.windLfo = ctx.createOscillator();
    this.windLfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 260;
    this.windLfo.connect(lfoGain).connect(this.wind.filters[0].frequency);
    this.windLfo.start();
    this.setStorm(this.storm);
  }

  loop(buffer, filters, gain) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    let node = src;
    const fl = filters.map(([type, f, q]) => {
      const b = ctx.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      if (q) b.Q.value = q;
      node.connect(b);
      node = b;
      return b;
    });
    const g = ctx.createGain();
    g.gain.value = gain;
    node.connect(g).connect(this.master);
    src.start(0, Math.random() * 2);
    return { src, filters: fl, gain: g };
  }

  /** 1 = chuva forte; 0 = só o vento seco do deserto. */
  setStorm(k) {
    this.storm = k;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.rain.gain.gain.setTargetAtTime(0.5 * k, t, 0.4);
    this.wind.gain.gain.setTargetAtTime(0.06 + 0.12 * (1 - k), t, 0.6);
  }

  /** Trovão (atraso curto = relâmpago perto). */
  thunder(delay = 0.4 + Math.random() * 1.2) {
    const ctx = this.ctx;
    if (!ctx || this.storm < 0.3) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(70, t + 3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1.4 * this.storm, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + 4.5);
  }

  /** Som 3D de uma fogueira acesa em (x, y, z). @returns {object|null} */
  addFire(x, y, z) {
    const ctx = this.ctx;
    if (!ctx) return null;
    const pan = ctx.createPanner();
    Object.assign(pan, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 2, maxDistance: 60, rolloffFactor: 1.4 });
    setPos(pan, x, y, z);
    pan.connect(this.master);
    const hiss = ctx.createBufferSource();
    hiss.buffer = this.noise;
    hiss.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    const hg = ctx.createGain();
    hg.gain.value = 0.05;
    hiss.connect(bp).connect(hg).connect(pan);
    hiss.start();
    const fire = { pan, hiss, next: 0 };
    this.fires.push(fire);
    return fire;
  }

  /** Posição/orientação do ouvinte e estalos das fogueiras. */
  update(camera) {
    const ctx = this.ctx;
    if (!ctx) return;
    const l = ctx.listener;
    const p = camera.position;
    const f = camera.getWorldDirection(_dir);
    if (l.positionX) {
      l.positionX.value = p.x; l.positionY.value = p.y; l.positionZ.value = p.z;
      l.forwardX.value = f.x; l.forwardY.value = f.y; l.forwardZ.value = f.z;
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else {
      l.setPosition?.(p.x, p.y, p.z);
      l.setOrientation?.(f.x, f.y, f.z, 0, 1, 0);
    }
    const now = ctx.currentTime;
    for (const fire of this.fires) {
      if (now < fire.next) continue;
      fire.next = now + 0.04 + Math.random() * 0.22;
      const s = ctx.createBufferSource();
      s.buffer = this.noise;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1500 + Math.random() * 3000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.25 + Math.random() * 0.5, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.03 + Math.random() * 0.05);
      s.connect(hp).connect(g).connect(fire.pan);
      s.start(now, Math.random() * 1.5);
      s.stop(now + 0.1);
    }
  }
}

const _dir = new THREE.Vector3();

function setPos(pan, x, y, z) {
  if (pan.positionX) { pan.positionX.value = x; pan.positionY.value = y; pan.positionZ.value = z; } else pan.setPosition(x, y, z);
}

function makeNoise(ctx) {
  const len = ctx.sampleRate * 2;
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
