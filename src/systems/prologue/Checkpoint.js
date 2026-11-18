/**
 * Checkpoint automático (localStorage, ou outro armazenamento injetado nos testes).
 *
 * @example
 *   const cp = new Checkpoint(PROLOGUE.checkpoint.key);
 *   cp.save({ x, y, z, yaw, hour, phase: 'ilha' });
 *   cp.load(); // { x, y, z, yaw, hour, phase, savedAt } ou null
 */
export class Checkpoint {
  /**
   * @param {string} key
   * @param {{ getItem(k: string): string|null, setItem(k: string, v: string): void, removeItem(k: string): void } | null} [storage]
   */
  constructor(key, storage = Checkpoint.defaultStorage()) {
    this.key = key;
    this.storage = storage;
  }

  static defaultStorage() {
    try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
  }

  save(data) {
    if (!this.storage) return false;
    const rec = { v: 1, ...data, savedAt: Date.now() };
    try { this.storage.setItem(this.key, JSON.stringify(rec)); return true; } catch { return false; }
  }

  /** @returns {object|null} null se não houver, ou se estiver corrompido/de outra versão */
  load() {
    try {
      const raw = this.storage?.getItem(this.key);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (d?.v !== 1 || ![d.x, d.y, d.z].every(Number.isFinite)) return null;
      return d;
    } catch { return null; }
  }

  get exists() { return !!this.load(); }

  clear() { try { this.storage?.removeItem(this.key); } catch { /* sem armazenamento */ } }
}
