/**
 * Telas do prólogo (DOM puro, CSS próprio):
 *  - StartScreen: título + Novo Jogo / Continuar / Modo livre
 *  - Cutscene: vídeo em tela cheia com áudio; Esc pausa/retoma; segurar Espaço pula
 *  - PrologueHUD: cronômetro, vinheta de exaustão, gotas na lente, bolhas, fade, Game Over
 *
 * @example
 *   const start = new StartScreen(root, { title, subtitle, hasSave: true });
 *   start.show({ onNew, onContinue, onFree });
 *   new Cutscene(root, { url, skipHold: 0.8 }).play().then(() => começarNoMar());
 */

const CSS = `
.pl-screen{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;color:#e8e2d6}
.pl-start{background:radial-gradient(ellipse at 50% 35%,rgba(40,48,58,.55),rgba(5,6,8,.96) 70%),#050608;flex-direction:column;gap:12px}
.pl-start h1{font-family:Georgia,serif;font-weight:400;font-size:clamp(34px,6vw,72px);letter-spacing:.06em;margin:0;text-shadow:0 0 30px rgba(0,0,0,.9)}
.pl-start .sub{opacity:.7;margin:0 0 26px;font-size:clamp(13px,1.6vw,17px);letter-spacing:.04em}
.pl-btn{min-width:240px;padding:12px 22px;margin:4px;border:1px solid rgba(232,226,214,.35);border-radius:6px;background:rgba(18,20,24,.75);color:inherit;font-size:16px;letter-spacing:.08em;cursor:pointer;transition:background .15s,border-color .15s}
.pl-btn:hover,.pl-btn:focus-visible{background:rgba(120,30,24,.55);border-color:rgba(255,190,170,.7);outline:none}
.pl-btn.primary{border-color:rgba(255,190,170,.6)}
.pl-btn[disabled]{opacity:.35;cursor:default}
.pl-start .hint{position:absolute;bottom:18px;opacity:.45;font-size:12px}
.pl-video{background:#000}
.pl-video video{width:100vw;height:100vh;object-fit:contain;background:#000}
.pl-video .cs-hint{position:absolute;bottom:22px;right:26px;font-size:13px;opacity:0;transition:opacity .4s;background:rgba(0,0,0,.55);padding:6px 12px;border-radius:4px}
.pl-video .cs-hint.on{opacity:.85}
.pl-video .cs-skip{position:absolute;bottom:22px;right:26px;width:120px;height:4px;background:rgba(255,255,255,.15);border-radius:2px;transform:translateY(-28px);opacity:0}
.pl-video .cs-skip i{display:block;height:100%;width:0;background:#e8e2d6;border-radius:2px}
.pl-video .cs-paused{position:absolute;inset:0;display:none;align-items:center;justify-content:center;font-size:22px;letter-spacing:.3em;background:rgba(0,0,0,.45)}
.pl-video.paused .cs-paused{display:flex}
.pl-video .cs-click{display:none}
.pl-video.blocked .cs-click{display:block}
.pl-video .cs-fail{display:none;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);max-width:80%;text-align:center;color:#e8dcc4;font:16px/1.5 system-ui,sans-serif;background:rgba(0,0,0,.6);padding:14px 20px;border-radius:8px}
.pl-video.failed .cs-fail{display:block}
.pl-fade{position:fixed;inset:0;background:#000;z-index:8900;pointer-events:none;opacity:0}
.pl-hud{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:9500;pointer-events:none;text-align:center;font-family:system-ui,sans-serif;color:#f1ece2;text-shadow:0 1px 6px #000;background:rgba(8,10,14,.72);border:1px solid rgba(241,236,226,.18);border-radius:8px;padding:6px 16px 7px}
.pl-hud .t{font-size:30px;font-variant-numeric:tabular-nums;letter-spacing:.06em}
.pl-hud .l{font-size:11px;letter-spacing:.25em;opacity:.75}
.pl-hud.low .t{color:#ff8a7a;animation:plpulse 1s infinite}
@keyframes plpulse{50%{opacity:.45}}
.pl-vig{position:fixed;inset:0;z-index:7900;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 45%,rgba(0,0,0,.95) 100%)}
.pl-lens{position:fixed;inset:0;z-index:7950;pointer-events:none;opacity:0;
 background:
  radial-gradient(circle at 12% 22%,rgba(200,220,235,.28) 0 1.2%,transparent 1.6%),
  radial-gradient(circle at 78% 18%,rgba(200,220,235,.22) 0 .9%,transparent 1.3%),
  radial-gradient(circle at 64% 70%,rgba(200,220,235,.25) 0 1.6%,transparent 2.1%),
  radial-gradient(circle at 30% 80%,rgba(200,220,235,.2) 0 1%,transparent 1.4%),
  radial-gradient(circle at 88% 55%,rgba(200,220,235,.22) 0 1.3%,transparent 1.8%),
  radial-gradient(circle at 46% 38%,rgba(200,220,235,.18) 0 .7%,transparent 1%),
  radial-gradient(circle at 20% 52%,rgba(200,220,235,.2) 0 1.1%,transparent 1.5%);
 backdrop-filter:blur(.6px)}
.pl-bubbles{position:fixed;inset:0;z-index:7960;pointer-events:none;overflow:hidden;display:none}
.pl-bubbles b{position:absolute;bottom:-40px;border-radius:50%;border:1px solid rgba(220,240,255,.55);background:rgba(200,230,255,.08);animation:plrise linear infinite}
@keyframes plrise{to{transform:translate(var(--dx),-115vh)}}
.pl-over{background:rgba(0,0,0,.92);flex-direction:column;gap:14px}
@media (prefers-reduced-motion: reduce){.pl-hud.low .t{animation:none}.pl-bubbles b{animation:none;display:none}}
.pl-over h2{font-family:Georgia,serif;font-weight:400;font-size:clamp(30px,5vw,58px);color:#b8322a;letter-spacing:.14em;margin:0 0 18px;text-shadow:0 0 24px rgba(160,20,10,.55)}
`;

let cssDone = false;
function css() {
  if (cssDone || typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.append(s);
  cssDone = true;
}
function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  parent?.append(e);
  return e;
}

/** Tela inicial. */
export class StartScreen {
  constructor(root, { title, subtitle }) {
    css();
    this.root = el('div', 'pl-screen pl-start', root);
    el('h1', '', this.root, title);
    el('p', 'sub', this.root, subtitle);
    this.btnNew = el('button', 'pl-btn primary', this.root, 'Novo Jogo');
    this.btnContinue = el('button', 'pl-btn', this.root, 'Continuar');
    this.btnFree = el('button', 'pl-btn', this.root, 'Modo livre');
    el('div', 'hint', this.root, 'Novo Jogo: abertura + naufrágio · Modo livre: explorar a partir da Vila Renascimento');
    this.root.style.display = 'none';
  }

  /** @param {{ hasSave: boolean, onNew: Function, onContinue: Function, onFree: Function }} o */
  show({ hasSave, onNew, onContinue, onFree }) {
    this.btnContinue.disabled = !hasSave;
    this.btnContinue.title = hasSave ? 'Volta ao último ponto salvo' : 'Nenhum progresso salvo ainda';
    this.btnNew.onclick = () => { this.hide(); onNew(); };
    this.btnContinue.onclick = () => { if (hasSave) { this.hide(); onContinue(); } };
    this.btnFree.onclick = () => { this.hide(); onFree(); };
    this.root.style.display = 'flex';
    this.btnNew.focus();
  }

  hide() { this.root.style.display = 'none'; }
  get visible() { return this.root.style.display !== 'none'; }
}

/**
 * Vídeo de abertura em tela cheia. `play()` resolve quando o vídeo termina (onended),
 * quando o jogador pula (segurando Espaço) ou se o vídeo não carregar.
 */
export class Cutscene {
  constructor(root, { url, urlWebm = null, hostedUrl = null, hostedUrlWebm = null, skipHold = 0.8 }) {
    css();
    this.url = url;
    this.urlWebm = urlWebm;
    this.hostedUrl = hostedUrl;
    this.hostedUrlWebm = hostedUrlWebm;
    this.skipHold = skipHold;
    this.root = el('div', 'pl-screen pl-video', root);
    this.video = el('video', '', this.root);
    this.video.playsInline = true;
    this.video.preload = 'auto';
    this.hint = el('div', 'cs-hint', this.root, 'Esc pausa · segure Espaço para pular');
    this.skipBar = el('div', 'cs-skip', this.root);
    this.skipFill = el('i', '', this.skipBar);
    el('div', 'cs-paused', this.root, 'PAUSADO');
    this.clickBtn = el('button', 'pl-btn cs-click', this.root, 'Clique para assistir');
    this.failMsg = el('div', 'cs-fail', this.root, 'Não foi possível carregar o vídeo de abertura. Indo direto para o mar…');
    this.root.style.display = 'none';
  }

  /**
   * Fontes em ordem de tentativa: o formato que o navegador toca primeiro (MP4 com H.264/AAC;
   * senão WebM), primeiro o arquivo do jogo e depois a cópia hospedada (página publicada).
   * @param {(type: string) => string} canPlay  ex.: `video.canPlayType`
   * @returns {string[]}
   */
  sources(canPlay) {
    const mp4 = !!canPlay('video/mp4; codecs="avc1.640028, mp4a.40.2"');
    const local = mp4 ? [this.url, this.urlWebm] : [this.urlWebm, this.url];
    const hosted = mp4 ? [this.hostedUrl, this.hostedUrlWebm] : [this.hostedUrlWebm, this.hostedUrl];
    return [...local, ...hosted].filter((u, i, a) => u && a.indexOf(u) === i);
  }

  play() {
    return new Promise((resolve) => {
      const v = this.video, root = this.root;
      let held = 0, raf = 0, last = performance.now(), done = false;
      const finish = () => {
        if (done) return;
        done = true;
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', down, true);
        window.removeEventListener('keyup', up, true);
        v.pause();
        root.style.display = 'none';
        resolve();
      };
      const showHint = () => { this.hint.classList.add('on'); clearTimeout(this._h); this._h = setTimeout(() => this.hint.classList.remove('on'), 2600); };
      const down = (e) => {
        if (e.code === 'Escape') {
          e.preventDefault(); e.stopPropagation();
          if (v.paused) { v.play(); root.classList.remove('paused'); } else { v.pause(); root.classList.add('paused'); }
        } else if (e.code === 'Space') { e.preventDefault(); e.stopPropagation(); this.spaceDown = true; showHint(); }
        else showHint();
      };
      const up = (e) => { if (e.code === 'Space') { e.preventDefault(); e.stopPropagation(); this.spaceDown = false; } };
      const tick = (t) => {
        const dt = Math.min(0.1, (t - last) / 1000); last = t;
        held = this.spaceDown ? held + dt : Math.max(0, held - dt * 3);
        this.skipBar.style.opacity = held > 0 ? 1 : 0;
        this.skipFill.style.width = `${Math.min(100, (held / this.skipHold) * 100)}%`;
        if (held >= this.skipHold) { finish(); return; }
        raf = requestAnimationFrame(tick);
      };
      v.onended = finish; // no exato fim do vídeo
      // Cada fonte que falha passa para a próxima; se nenhuma carregar, avisa na tela e segue.
      const list = this.sources((t) => v.canPlayType(t));
      let idx = 0;
      const start = () => {
        v.src = list[idx];
        v.currentTime = 0;
        v.play().then(showHint).catch((err) => {
          if (err?.name !== 'NotAllowedError') return; // erro de carga: o onerror cuida
          // Navegador recusou tocar com som sem um gesto: um clique resolve.
          root.classList.add('blocked');
          this.clickBtn.onclick = () => { root.classList.remove('blocked'); v.play().then(showHint).catch(finish); };
        });
      };
      v.onerror = () => {
        console.warn(`[abertura] não carregou: ${list[idx]}`);
        if (++idx < list.length) { start(); return; }
        root.classList.add('failed');
        setTimeout(finish, 2600);
      };
      window.addEventListener('keydown', down, true);
      window.addEventListener('keyup', up, true);
      root.classList.remove('paused', 'blocked', 'failed');
      root.style.display = 'flex';
      this.spaceDown = false;
      v.muted = false;
      if (!list.length) { root.classList.add('failed'); setTimeout(finish, 2600); } else start();
      raf = requestAnimationFrame(tick);
    });
  }
}

/** HUD do naufrágio: cronômetro, vinheta, gotas, bolhas, fade e Game Over. */
export class PrologueHUD {
  constructor(root) {
    css();
    this.hud = el('div', 'pl-hud', root);
    this.time = el('div', 't', this.hud, '10:00');
    el('div', 'l', this.hud, 'ATÉ A EXAUSTÃO');
    this.vig = el('div', 'pl-vig', root);
    this.lens = el('div', 'pl-lens', root);
    this.bubbles = el('div', 'pl-bubbles', root);
    for (let i = 0; i < 26; i++) {
      const b = el('b', '', this.bubbles), s = 4 + Math.random() * 16;
      b.style.cssText = `left:${Math.random() * 100}%;width:${s}px;height:${s}px;animation-duration:${2.5 + Math.random() * 3}s;animation-delay:${-Math.random() * 4}s;--dx:${(Math.random() - 0.5) * 120}px`;
    }
    this.fade = el('div', 'pl-fade', root);
    this.over = el('div', 'pl-screen pl-over', root);
    el('h2', '', this.over, 'VOCÊ MORREU AFOGADO');
    this.btnRetry = el('button', 'pl-btn primary', this.over, 'Tentar Novamente');
    this.btnMenu = el('button', 'pl-btn', this.over, 'Sair para o Menu');
    this.over.style.display = 'none';
    this.setVisible(false);
  }

  setVisible(on) {
    this.hud.style.display = on ? 'block' : 'none';
    if (!on) { this.vig.style.opacity = 0; this.lens.style.opacity = 0; this.bubbles.style.display = 'none'; }
  }

  /** @param {{ label: string, remaining: number, exhaustion: number, pulse: number, lens: number }} s */
  update(s) {
    this.time.textContent = s.label;
    this.hud.classList.toggle('low', s.remaining <= 60);
    // Vinheta pulsando no ritmo da respiração, mais forte com a exaustão.
    this.vig.style.opacity = s.exhaustion > 0 ? (0.18 + 0.5 * s.exhaustion) * (0.75 + 0.25 * s.pulse) : 0;
    this.lens.style.opacity = s.lens;
  }

  setFade(a) { this.fade.style.opacity = a; }
  setBubbles(on) { this.bubbles.style.display = on ? 'block' : 'none'; }

  /** @param {{ onRetry: Function, onMenu: Function }} o */
  showGameOver({ onRetry, onMenu }) {
    this.over.style.display = 'flex';
    this.btnRetry.onclick = () => { this.hideGameOver(); onRetry(); };
    this.btnMenu.onclick = () => { this.hideGameOver(); onMenu(); };
    this.btnRetry.focus();
  }

  hideGameOver() { this.over.style.display = 'none'; }
}
