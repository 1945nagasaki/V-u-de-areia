import { ITEMS } from '../PlayerState.js';
import { MISSIONS, MISSION_SAVE_KEY, MISSION_TEXT, OBJECTIVE_TYPES, POST_TUTORIAL_MISSION, fillText } from '../../config/missions.js';
import { MissionManager, isForagedFood } from './MissionManager.js';
import { floatText } from '../../ui/FloatText.js';
import { QuestTracker } from '../../ui/QuestTracker.js';
import { MissionSounds } from '../../audio/MissionSounds.js';

/**
 * Liga o MissionManager (puro) ao jogo:
 *  - conta comida pelo evento 'item-added' do PlayerState (qualquer item comestível);
 *  - recompensa: XP pela Árvore de Skills (`game.progress`) e moedas (`state.coins`);
 *  - rastreador, banner e som de conclusão;
 *  - save próprio (MISSION_SAVE_KEY) + `game.progress.save()`.
 * O ProgressionDirector chama `start(POST_TUTORIAL_MISSION)` quando o tutorial termina
 * (ver `onTutorialDone`) e `reset()` no Novo Jogo.
 *
 * @example
 *   game.missions = new MissionDirector(game); // logo depois de game.progress
 */
export class MissionDirector {
  /**
   * @param {object} game
   * @param {{ tracker?: object, sounds?: object, storage?: Storage|null, items?: object, manager?: MissionManager }} [deps]
   *   dependências injetáveis (testes passam `null` para rodar sem DOM); sem elas usa a UI, o Web Audio e o localStorage reais.
   */
  constructor(game, deps = {}) {
    this.game = game;
    this.items = deps.items ?? ITEMS;
    this.manager = deps.manager ?? new MissionManager();
    this.storage = 'storage' in deps ? deps.storage : safeStorage();
    this.tracker = 'tracker' in deps ? deps.tracker : new QuestTracker(game.ui.root);
    this.sounds = 'sounds' in deps ? deps.sounds : new MissionSounds();
    this.manager.onChange((e) => this.onMission(e));
    // Crafting: o que entra na mochila DURANTE a fabricação na mesa conta como "craftado".
    const craft = typeof game.craftFromTable === 'function' ? game.craftFromTable : null;
    if (craft) {
      game.craftFromTable = (...args) => { this.crafting = true; try { return craft.apply(game, args); } finally { this.crafting = false; } };
    }
    game.state.on('item-added', ({ id, n } = {}) => {
      if (this.crafting) this.manager.progress(OBJECTIVE_TYPES.craft_item, n ?? 1, id);
    });
    game.state.on('item-added', ({ id, n } = {}) => {
      // Só fruta colhida ou carne coletada; o cru devolvido pela fila da fogueira não conta.
      if (isForagedFood(this.items[id]) && !game.cooking?.returning) this.manager.progress(OBJECTIVE_TYPES.collect_food, n ?? 1);
    });
    this.load();
  }

  /** Começa uma missão (ignora se já ativa ou concluída). */
  start(id) {
    return this.manager.start(id);
  }

  /** Tutorial de 9 passos terminou: começa a missão seguinte. */
  onTutorialDone() {
    return this.start(POST_TUTORIAL_MISSION);
  }

  onMission(e) {
    const g = this.game;
    if (e.type === 'start') g.ui?.toast?.(fillText(MISSION_TEXT.started, { title: e.mission.title }));
    if (e.type === 'complete') {
      this.reward(e.mission);
      // Corrente: a próxima missão começa logo depois das recompensas.
      const next = MISSIONS[e.mission.id]?.next;
      if (next) queueMicrotask(() => this.start(next));
    }
    if (e.type !== 'load' && e.type !== 'reset') this.save();
    this.tracker?.render(this.manager.list());
    if (e.type === 'reset') this.tracker?.hideBanner?.();
  }

  /** +XP, +moedas, som, banner e save do progresso. */
  reward(m) {
    const g = this.game, st = g.state;
    if (m.goldReward > 0) {
      st.coins += m.goldReward;
      st.emit('change');
    }
    if (m.xpReward > 0) g.progress?.progression.addXp(m.xpReward);
    this.sounds?.complete();
    this.tracker?.showComplete(m);
    if (m.goldReward > 0 && g.ui?.root) floatText(g.ui.root, `+${m.goldReward} Ouro`, 'gold');
    this.save();
    g.progress?.save();
    g.prologue?.saveCheckpoint?.(); // checkpoint automático (posição atual)
    g.gear?.save?.(); // moedas no save da mochila na hora, sem esperar o autosave
  }

  save() {
    if (!this.storage) return false;
    try { this.storage.setItem(MISSION_SAVE_KEY, JSON.stringify(this.manager.toJSON())); return true; } catch { return false; }
  }

  load() {
    let d = null;
    try { d = JSON.parse(this.storage?.getItem(MISSION_SAVE_KEY) ?? 'null'); } catch { d = null; }
    if (d) this.manager.load(d);
    else this.tracker?.render([]);
  }

  /** Novo Jogo: apaga o save das missões. */
  reset() {
    try { this.storage?.removeItem(MISSION_SAVE_KEY); } catch { /* sem armazenamento */ }
    this.manager.reset();
  }
}

function safeStorage() {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}
