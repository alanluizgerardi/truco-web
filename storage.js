import { initialState, validateState } from './engine.js';

export const storageKey = pathname => `truco-avulso:v1:${pathname.replace(/index\.html$/, '').replace(/\/?$/, '/')}`;

export class MatchStorage {
  constructor(storage, key) {
    this.storage = storage;
    this.key = key;
    this.error = null;
    this.corrupt = null;
    this.blocked = false;
  }

  load() {
    this.error = null;
    try {
      const raw = this.storage.getItem(this.key);
      if (!raw) return initialState();
      try {
        const saved = validateState(JSON.parse(raw));
        // Apply the new default once to existing matches, without losing the game
        // or overriding later color choices made in Settings.
        if (saved.preferences.themeRevision !== 1) {
          const migrated = { ...saved, revision: saved.revision + 1,
            preferences: { ...saved.preferences, theme: 'black', themeRevision: 1 } };
          this.save(migrated);
          return migrated;
        }
        return saved;
      } catch {
        this.corrupt = raw;
        this.blocked = true;
        this.error = 'O placar salvo está ilegível. Recupere os dados antes de continuar.';
        return initialState();
      }
    } catch {
      this.error = 'O navegador não permitiu acessar os dados salvos. As marcações ficarão apenas nesta aba e podem ser perdidas ao atualizar ou sair.';
      return initialState();
    }
  }

  save(state) {
    validateState(state);
    if (this.blocked) throw new Error(this.error);
    try {
      this.storage.setItem(this.key, JSON.stringify(state));
      this.error = null;
      return true;
    } catch {
      this.error = 'Não foi possível salvar no navegador. O placar está apenas nesta aba e pode ser perdido ao atualizar ou sair.';
      return false;
    }
  }

  latest() {
    // Do not replace an unsaved in-memory score when storage is unavailable/full.
    if (this.error) return null;
    try {
      const raw = this.storage.getItem(this.key);
      return raw ? validateState(JSON.parse(raw)) : null;
    } catch {
      this.error = 'Os dados salvos mudaram e não puderam ser lidos. O placar desta aba foi mantido, mas não pode ser salvo.';
      this.blocked = true;
      return null;
    }
  }

  replace(state) {
    validateState(state);
    // Writing the replacement first preserves the original if storage fails.
    this.storage.setItem(this.key, JSON.stringify(state));
    this.blocked = false;
    this.corrupt = null;
    this.error = null;
    return state;
  }
}
