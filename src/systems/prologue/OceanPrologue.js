import * as THREE from 'three';
import { PROLOGUE } from '../../config/prologue.js';
import { WORLD } from '../../config/worldConfig.js';
import { DrowningTimer } from './DrowningTimer.js';
import { Checkpoint } from './Checkpoint.js';
import { StormSeaAudio } from '../../audio/StormSeaAudio.js';
import { StartScreen, Cutscene, PrologueHUD } from '../../ui/PrologueScreens.js';

const smooth = (t) => { const u = Math.min(1, Math.max(0, t)); return u * u * (3 - 2 * u); };

/**
 * Fluxo de abertura do jogo e o naufrágio:
 *
 *   menu ──Novo Jogo──▶ cutscene ──onended──▶ swim ──chegou à praia──▶ done (checkpoint)
 *                                              └─10:00 na água──▶ drown ──▶ over ──Tentar de novo──▶ swim
 *                                                                              └──Sair para o Menu──▶ menu
 *   menu ──Continuar──▶ done (no checkpoint)   ·   menu ──Modo livre──▶ done (Vila Renascimento)
 *
 * `game.mode` diz ao loop o que rodar: 'menu' e 'cutscene' não simulam (o mundo fica parado);
 * 'play' é o jogo normal (o Esc continua abrindo a pausa, que congela tudo, inclusive o cronômetro).
 *
 * @example
 *   this.prologue = new OceanPrologue(this);
 *   this.prologue.showMenu();            // no fim do carregamento
 *   // loop (depois do clima): this.prologue.update(dt)
 */
export class OceanPrologue {
  /** @param {import('../../core/Game.js').Game} game */
  constructor(game) {
    this.game = game;
    this.cfg = PROLOGUE;
    this.state = 'idle';
    this.timer = new DrowningTimer(PROLOGUE.timer);
    this.checkpoint = new Checkpoint(PROLOGUE.checkpoint.key);
    this.sea = new StormSeaAudio(PROLOGUE.audio);
    const root = document.body;
    this.start = new StartScreen(root, PROLOGUE);
    this.cutscene = new Cutscene(root, PROLOGUE.cutscene);
    this.hud = new PrologueHUD(root);
    this.landHeld = 0;
    this.lens = 0;
    this.t = 0;
    this._v = new THREE.Vector3();
  }

  /** O jogador está no trecho nadando (o resto do jogo consulta isto: fôlego, etc.). */
  get swimming() { return this.state === 'swim'; }

  // ------------------------------------------------------------ menu e abertura
  showMenu() {
    const g = this.game;
    g.mode = 'menu';
    g.input.unlock?.();
    this.start.show({
      hasSave: this.checkpoint.exists,
      onNew: () => this.newGame(),
      onContinue: () => this.continueGame(),
      onFree: () => this.freeMode(),
    });
  }

  async newGame() {
    const g = this.game;
    this.checkpoint.clear();
    g.progress?.reset(); // novo jogo: XP, skills, tutorial e fogueiras do zero
    this.sea.start(); // dentro do clique: o navegador libera o áudio
    this.sea.stop(); // (silencioso durante o vídeo)
    g.mode = 'cutscene';
    this.hud.setFade(1); // tela preta durante e logo depois do vídeo
    await this.cutscene.play();
    this.begin(); // no exato fim do vídeo
  }

  continueGame() {
    const g = this.game, c = this.checkpoint.load();
    if (!c) { this.freeMode(); return; }
    g.player.flying = false;
    g.player.teleport(c.x, c.z, c.yaw ?? 0, c.y);
    if (Number.isFinite(c.hour)) g.gameClock.totalHours = Math.floor(g.gameClock.totalHours / 24) * 24 + c.hour;
    g.cameraRig.yaw = c.yaw ?? 0; g.cameraRig.snap();
    this.state = 'done';
    g.mode = 'play';
    g.ui.toast('Progresso carregado: a praia onde você chegou depois do naufrágio.');
    g.progress?.resume(); // tutorial de onde parou, fogueiras acesas
  }

  freeMode() {
    const g = this.game;
    this.state = 'done';
    g.mode = 'play';
    g.progress?.resume(); // fogueiras salvas (o tutorial só começa pelo prólogo)
    g.ui.toast('Bem-vindo à Vila Renascimento. ALT trava/destrava a câmera · T alterna 1ª/3ª pessoa · C examina o corpo.');
  }

  // ------------------------------------------------------------ no mar
  /** Ponto de partida: mar adentro, a `spawn.distance` m da praia em frente à vila. */
  spawnPoint() {
    const g = this.game, S = this.cfg.spawn, v = g.villages[S.village] ?? g.villages.renascimento;
    // Da vila para o oeste até achar a água (a praia), depois mar adentro.
    let x = v.x;
    const z = v.z;
    for (let i = 0; i < 2000 && x > -WORLD.width / 2; i++, x -= 2) if (g.terrain.heightAt(x, z) < WORLD.waterLevel - 0.5) break;
    return { x: x - S.distance, z, beachX: x };
  }

  /** Começa (ou recomeça) o trecho nadando. */
  begin() {
    const g = this.game, S = this.cfg.spawn, p = g.player;
    const sp = this.spawnPoint();
    this.spawn = sp;
    // De costas para a ilha (a ilha fica a leste: +x).
    const yaw = S.facingAway ? -Math.PI / 2 : Math.PI / 2;
    p.flying = false;
    p.frozen = false;
    p.teleport(sp.x, sp.z, yaw, WORLD.waterLevel - 1.2);
    p.swimming = true;
    p.swimSprint = { multiplier: this.cfg.swim.sprintMultiplier, factor: 1 };
    g.state.healFull?.();
    g.oxygen.reset();
    g.dead = false;
    g.cameraRig.yaw = yaw; g.cameraRig.snap();
    // Noite de tempestade, mar grosso.
    g.gameClock.totalHours = Math.floor(g.gameClock.totalHours / 24) * 24 + 24 + S.hour;
    for (const b of this.cfg.storm.biomes) g.weather.force(b, 'tempestade', this.cfg.storm.hours);
    if (!this.windSaved) { this.windSaved = { ...g.water.cfg.local }; }
    g.water.setWind?.({ windSpeed: this.cfg.storm.windSpeed ?? 15 });
    this.timer.reset();
    this.landHeld = 0;
    this.t = 0;
    this.state = 'swim';
    this.hud.setVisible(true);
    this.hud.setBubbles(false);
    this.fadeIn = this.cfg.cutscene.fadeIn;
    this.hud.setFade(1);
    this.sea.start();
    g.thunder?.setMuffled?.(null);
    g.mode = 'play';
  }

  /** Um quadro (chamar depois do clima, antes de desenhar). */
  update(dt) {
    if (this.state === 'idle' || this.state === 'done') return;
    const g = this.game, p = g.player, paused = !!g.pauseMenu?.open;
    this.t += dt;
    if (this.fadeIn > 0) { this.fadeIn = Math.max(0, this.fadeIn - dt); this.hud.setFade(this.fadeIn / this.cfg.cutscene.fadeIn); }
    if (this.state === 'swim') this.updateSwim(dt, paused);
    else if (this.state === 'drown') this.updateDrown(dt, paused);
  }

  /**
   * Noite de tempestade: neblina limitada (a ilha aparece como silhueta), névoa/céu escuros,
   * menos luz ambiente e exposição. O Environment reescreve tudo a cada quadro, então nada
   * acumula; vale também com o jogo pausado (a cena continua desenhada).
   */
  applyStormLook() {
    const g = this.game, C = this.cfg.storm, fog = g.scene.fog;
    if (!fog) return;
    if (fog.density > C.fogDensityMax) fog.density = C.fogDensityMax;
    this._dark ??= new THREE.Color(C.darkColor);
    fog.color.lerp(this._dark, C.darkMix);
    const sky = g.environment?.skyUniforms;
    if (sky) { sky.uTop.value.lerp(this._dark, C.darkMix); sky.uHorizon.value.lerp(this._dark, C.darkMix * 0.9); }
    if (g.environment?.hemi) g.environment.hemi.intensity *= C.hemiMul;
    g.renderer.toneMappingExposure *= C.exposureMul;
    // Lua atrás das nuvens: a luz direcional e o brilho dela nas ondas caem — menos no clarão do raio.
    const lit = (g.weather?.flash ?? 0) > 0.05;
    if (!lit) {
      if (g.environment?.sun) g.environment.sun.intensity *= C.moonMul;
      g.water?.uniforms?.uSunColor?.value.multiplyScalar(C.moonMul);
    }
  }

  updateSwim(dt, paused) {
    const g = this.game, p = g.player, C = this.cfg;
    this.applyStormLook();
    for (const w of this.timer.tick(dt)) {
      const msg = { 420: 'Seus braços começam a pesar…', 480: 'A respiração fica curta. Ache a ilha.', 540: 'Você está no limite. Mais um minuto.' }[w];
      if (msg) g.ui.toast(msg);
    }
    const e = this.timer.exhaustion;
    if (p.swimSprint) p.swimSprint.factor = 1 - C.timer.sprintSlowdown * e;
    // Gotas na lente: onda alta perto da câmera (ou a chuva batendo).
    const waterY = typeof p.waterHeight === 'function' ? p.waterHeight() : WORLD.waterLevel;
    const camAbove = g.camera.position.y - waterY;
    const target = Math.max(0.22, Math.min(1, (1.1 - camAbove) / 0.9));
    this.lens += (target - this.lens) * Math.min(1, dt * (target > this.lens ? 10 : 1.2));
    const pulse = 0.5 + 0.5 * Math.sin(this.t * Math.PI * 2 / (3.4 - 1.8 * e));
    this.hud.update({ label: this.timer.label, remaining: this.timer.remaining, exhaustion: e, pulse, lens: this.lens });
    this.sea.update(dt, {
      paused, underwater: p.submerged, exhaustion: e, moving: p.speed > 0.1,
      sprint: p.sprinting, headAbove: !p.submerged,
    });
    if (paused) return;
    // Chegou: em terra firme (fora d'água) por um instante.
    const ground = g.groundHeight(p.position.x, p.position.z, p.position.y + 0.3);
    const onLand = !p.swimming && ground > WORLD.waterLevel + C.landing.minGround;
    this.landHeld = onLand ? this.landHeld + dt : 0;
    if (this.landHeld >= C.landing.holdSeconds) { this.land(); return; }
    if (this.timer.expired) this.startDrowning();
  }

  /** Chegou à ilha: para o cronômetro, volta ao andar normal e salva. */
  land() {
    const g = this.game, p = g.player;
    this.timer.stop();
    this.state = 'done';
    p.swimSprint = null;
    this.hud.setVisible(false);
    this.sea.stop();
    if (this.windSaved) { g.water.setWind?.(this.windSaved); this.windSaved = null; }
    const ok = this.checkpoint.save({ x: p.position.x, y: p.position.y, z: p.position.z, yaw: Math.atan2(p.facing.x, p.facing.z), hour: g.gameClock.hour, phase: 'ilha' });
    g.ui.toast(`Você chegou à ilha, exausto, mas vivo.${ok ? ' Progresso salvo.' : ''}`);
    g.progress?.onLanded(); // XP da chegada e começo do tutorial
  }

  // ------------------------------------------------------------ afogamento
  startDrowning() {
    const g = this.game, p = g.player;
    this.state = 'drown';
    this.drownT = 0;
    p.frozen = true; // sem controle
    this.drownFrom = p.position.y;
    this.wasFirst = g.cameraRig.isFirstPerson;
    if (!g.cameraRig.isFirstPerson) g.cameraRig.toggleMode();
    this.hud.setVisible(false);
    g.input.unlock?.();
    g.ui.toast('Você não aguenta mais…');
  }

  updateDrown(dt, paused) {
    const g = this.game, p = g.player, D = this.cfg.drowning;
    this.applyStormLook();
    this.sea.update(dt, { paused, underwater: this.drownT > 0.8, drowning: true });
    if (paused) return;
    this.drownT += dt;
    const k = smooth(this.drownT / D.sinkSeconds);
    // Afunda devagar, olhando para a superfície que se afasta.
    p.position.y = this.drownFrom - D.sinkDepth * k;
    p.submerged = true;
    g.cameraRig.firstPitch = 0.55 * k;
    g.thunder?.setMuffled?.(this.drownT > 0.8 ? this.cfg.audio.underwaterCutoff : null);
    this.hud.setBubbles(this.drownT > 0.5);
    const fade = smooth((this.drownT - (D.sinkSeconds - D.fadeSeconds * 0.5)) / D.fadeSeconds);
    this.hud.setFade(fade);
    if (fade >= 1 && this.state === 'drown') {
      this.state = 'over';
      g.mode = 'over';
      this.sea.stop();
      this.hud.setBubbles(false);
      this.hud.showGameOver({ onRetry: () => this.retry(), onMenu: () => this.toMenu() });
    }
  }

  /** "Tentar Novamente": direto de volta ao mar (sem o vídeo). */
  retry() {
    const g = this.game;
    g.player.frozen = false;
    if (!this.wasFirst && g.cameraRig.isFirstPerson) g.cameraRig.toggleMode();
    this.begin();
  }

  /** "Sair para o Menu". */
  toMenu() {
    const g = this.game;
    g.player.frozen = false;
    g.player.swimSprint = null;
    if (!this.wasFirst && g.cameraRig.isFirstPerson) g.cameraRig.toggleMode();
    if (this.windSaved) { g.water.setWind?.(this.windSaved); this.windSaved = null; }
    g.thunder?.setMuffled?.(null);
    this.state = 'idle';
    this.hud.setVisible(false);
    this.hud.setFade(0);
    // Volta o personagem para a vila inicial (o "Modo livre" começa de lá).
    const v = g.villages.renascimento;
    g.player.teleport(v.x + 3, v.z + 17, Math.PI);
    this.showMenu();
  }
}
