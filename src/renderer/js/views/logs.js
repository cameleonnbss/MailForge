/* language: JavaScript, file: src/renderer/js/views/logs.js
   Live log console: tail, level filter, text search, export, copy. */
(function () {
  const MF = (window.MF = window.MF || {});
  const { svg } = MF.icons;
  const { esc, notify, copy, saveText } = MF.ui;

  let entries = [];
  let level = 'all';
  let search = '';
  let paused = false;

  const LEVELS = ['all', 'info', 'success', 'warn', 'error'];

  function visible() {
    const needle = search.toLowerCase();
    return entries.filter((entry) => {
      if (level !== 'all' && entry.level !== level) return false;
      if (needle && !`${entry.message} ${entry.scope || ''}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }

  function line(entry) {
    return `<div class="log-line ${esc(entry.level)}">
      <span class="ts">${esc(MF.ui.time(entry.ts))}</span>
      <span class="lvl">${esc(String(entry.level).toUpperCase())}</span>
      <span class="msg">${entry.scope ? `<span style="color:#6b7d9c">[${esc(entry.scope)}]</span> ` : ''}${esc(entry.message)}</span>
    </div>`;
  }

  MF.router.register({
    id: 'logs',
    title: 'Journaux',
    group: 'Pilotage',
    icon: 'terminal',
    description: 'Flux d\'evenements en direct.',

    async preload() {
      entries = (await MF.api.logs.list({ limit: 400 })).slice().reverse();
    },

    render() {
      const list = visible();
      const counts = entries.reduce((acc, entry) => {
        acc[entry.level] = (acc[entry.level] || 0) + 1;
        return acc;
      }, {});
      return `
        <div class="page-head">
          <div class="titles">
            <h1>Journaux</h1>
            <p class="sub">Tout ce que fait l'application : tests de connexion, envois, refus serveur, erreurs de fournisseur. Le flux se met a jour en direct et reste borne a 800 lignes.</p>
          </div>
          <div class="actions">
            <button class="btn" data-pause>${svg(paused ? 'play' : 'stop', 15)} ${paused ? 'Reprendre' : 'Pause'}</button>
            <button class="btn" data-copy>${svg('copy', 15)} Copier</button>
            <button class="btn" data-export>${svg('download', 15)} Exporter</button>
            <button class="btn danger" data-clear>${svg('trash', 15)} Vider</button>
          </div>
        </div>

        <div class="row" style="margin-bottom:var(--s-3)">
          <div class="tabs">
            ${LEVELS.map((value) => `<button class="tab ${level === value ? 'active' : ''}" data-level="${value}">${value === 'all' ? 'Tous' : value} ${counts[value] ? `<span class="hint">${counts[value]}</span>` : ''}</button>`).join('')}
          </div>
          <span class="spacer"></span>
          <span class="pill ${paused ? 'warn' : 'ok'}"><span class="dot ${paused ? '' : 'live'}"></span>${paused ? 'en pause' : 'en direct'}</span>
          <label class="field" style="width:250px"><input type="search" data-search value="${esc(search)}" placeholder="Filtrer le texte"></label>
        </div>

        <div class="log-view" data-log style="height:calc(100vh - 320px);min-height:340px">
          ${list.length ? list.map(line).join('') : MF.ui.empty('terminal', 'Aucune entree', 'Les evenements apparaissent ici des la premiere action.')}
        </div>`;
    },

    async mount({ host }) {
      const view = host.querySelector('[data-log]');
      view.scrollTop = view.scrollHeight;

      this.unsubscribe = MF.api.onEvent(({ type, payload }) => {
        if (type !== 'log' || paused) return;
        entries.push(payload);
        if (level !== 'all' && payload.level !== level) return;
        const node = document.createElement('div');
        node.className = `log-line ${payload.level}`;
        node.innerHTML = `<span class="ts">${esc(MF.ui.time(payload.ts || Date.now()))}</span><span class="lvl">${esc(String(payload.level).toUpperCase())}</span><span class="msg">${esc(payload.message)}</span>`;
        if (!view.isConnected) return;
        view.appendChild(node);
        while (view.childElementCount > 900) view.firstElementChild.remove();
        view.scrollTop = view.scrollHeight;
      });

      MF.ui.onClick(host, '[data-level]', (target) => {
        level = target.dataset.level;
        MF.router.reload();
      });
      host.querySelector('[data-search]')?.addEventListener('input', MF.ui.debounce((event) => {
        search = event.target.value;
        MF.router.reload();
      }, 300));
      MF.ui.onClick(host, '[data-pause]', () => {
        paused = !paused;
        MF.router.reload();
      });
      MF.ui.onClick(host, '[data-copy]', () => copy(visible().map((entry) => `${entry.ts} ${String(entry.level).toUpperCase()} ${entry.message}`).join('\n'), 'Journal copie'));
      MF.ui.onClick(host, '[data-export]', async () => {
        await saveText(visible().map((entry) => `${entry.ts}\t${entry.level}\t${entry.message}`).join('\n'), 'mailforge-journal.log', [
          { name: 'Log', extensions: ['log', 'txt'] }
        ]);
      });
      MF.ui.onClick(host, '[data-clear]', async () => {
        const ok = await MF.ui.confirm({ title: 'Vider le journal', message: 'Toutes les entrees enregistrees seront supprimees.', confirmLabel: 'Vider', kind: 'danger' });
        if (!ok) return;
        await MF.api.logs.clear();
        entries = [];
        notify.ok('Journal vide');
        MF.router.reload();
      });
    },

    unmount() {
      if (this.unsubscribe) this.unsubscribe();
    }
  });
})();
