import { SAVE_KEY } from '../config/survival.js';

/**
 * Checkpoint em `localStorage` (armazenamento injetável para testes).
 * Toda falha de leitura/escrita é engolida: o jogo segue sem salvar.
 *
 * @example
 *   const save = new SaveGame(window.localStorage);
 *   save.write({ pos: { x, y, z }, ... });
 *   const data = save.read(); // null se não houver
 */
export class SaveGame {
  constructor(storage, key = SAVE_KEY) {
    this.storage = storage;
    this.key = key;
  }

  /** @returns {boolean} salvou? */
  write(data) {
    try {
      this.storage?.setItem(this.key, JSON.stringify({ v: 1, savedAt: Date.now(), ...data }));
      return true;
    } catch {
      return false;
    }
  }

  read() {
    try {
      const raw = this.storage?.getItem(this.key);
      const d = raw ? JSON.parse(raw) : null;
      return d && d.v === 1 ? d : null;
    } catch {
      return null;
    }
  }

  clear() {
    try { this.storage?.removeItem(this.key); } catch { /* sem armazenamento */ }
  }
}
