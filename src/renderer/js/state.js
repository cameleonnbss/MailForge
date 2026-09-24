/* language: JavaScript, file: src/renderer/js/state.js
   Cached copy of the persisted settings plus theme application. Views read from
   here; writes go through to the main process and refresh the cache. */
(function () {
  const MF = (window.MF = window.MF || {});

  const ACCENTS = [
    { id: 'indigo', label: 'Indigo', color: '#7c8cff' },
    { id: 'emerald', label: 'Emeraude', color: '#34d399' },
    { id: 'cyan', label: 'Cyan', color: '#38bdf8' },
    { id: 'amber', label: 'Ambre', color: '#f59e0b' },
    { id: 'rose', label: 'Rose', color: '#fb7185' },
    { id: 'violet', label: 'Violet', color: '#a78bfa' }
  ];

  const state = {
    snapshot: null,
    ACCENTS,
    listeners: new Set(),

    async load() {
      state.snapshot = await MF.api.store.all();
      state.applyUi();
      return state.snapshot;
    },

    get(path, fallback) {
      if (!state.snapshot) return fallback;
      const value = String(path)
        .split('.')
        .reduce((acc, key) => (acc === null || acc === undefined ? undefined : acc[key]), state.snapshot);
      return value === undefined ? fallback : value;
    },

    async set(path, value) {
      await MF.api.store.set(path, value);
      await state.refresh();
      return value;
    },

    async merge(patch) {
      state.snapshot = await MF.api.store.merge(patch);
      state.applyUi();
      state.emit();
      return state.snapshot;
    },

    async refresh() {
      state.snapshot = await MF.api.store.all();
      state.applyUi();
      state.emit();
      return state.snapshot;
    },

    emit() {
      for (const listener of state.listeners) listener(state.snapshot);
    },

    subscribe(listener) {
      state.listeners.add(listener);
      return () => state.listeners.delete(listener);
    },

    applyUi() {
      const root = document.documentElement;
      const ui = state.get('ui', {});
      root.dataset.accent = ui.accent || 'indigo';
      root.dataset.theme = ui.theme || 'dark';
      root.dataset.density = ui.compact ? 'compact' : 'comfortable';
      root.dataset.animations = ui.animations === false ? 'off' : 'on';
    },

    async setAccent(accent) {
      await MF.api.store.merge({ ui: { accent } });
      await state.refresh();
      return accent;
    },

    async setUi(patch) {
      await MF.api.store.merge({ ui: patch });
      await state.refresh();
      return state.get('ui');
    }
  };

  /* Cross-view payload: an AI draft, a template or a snippet on its way to the
     composer. Not persisted — it only bridges one navigation. */
  state.handoff = null;

  MF.state = state;
})();
