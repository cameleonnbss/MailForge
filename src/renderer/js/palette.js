/* language: JavaScript, file: src/renderer/js/palette.js
   Command palette (Ctrl+K): navigation, actions and setting toggles in one
   filterable list, driven entirely by the keyboard. */
(function () {
  const MF = (window.MF = window.MF || {});
  const { svg } = MF.icons;
  const { esc, notify } = MF.ui;

  let node = null;
  let items = [];
  let filtered = [];
  let cursor = 0;

  function actions() {
    const ui = MF.state.get('ui', {});
    return [
      { id: 'new-message', label: 'Nouveau message', hint: 'Compositeur', icon: 'send', group: 'Actions', run: () => MF.router.go('compose') },
      { id: 'new-campaign', label: 'Lancer une campagne', hint: 'Envoi a une liste', icon: 'users', group: 'Actions', run: () => MF.router.go('campaign') },
      { id: 'new-box', label: 'Creer une boite temporaire', hint: 'Adresse jetable', icon: 'inbox', group: 'Actions', run: () => MF.router.go('tempmail') },
      { id: 'new-template', label: 'Nouveau modele e-mail', hint: 'Bibliotheque', icon: 'template', group: 'Actions', run: () => MF.router.go('templates') },
      { id: 'new-snippet', label: 'Nouveau snippet', hint: 'Bloc reutilisable', icon: 'clipboard', group: 'Actions', run: () => MF.router.go('snippets') },
      { id: 'export-config', label: 'Exporter la configuration', hint: 'JSON sans secrets', icon: 'download', group: 'Actions', run: exportConfig },
      { id: 'export-history', label: 'Exporter l\'historique', hint: 'CSV', icon: 'download', group: 'Actions', run: exportHistory },
      { id: 'open-datadir', label: 'Ouvrir le dossier de donnees', hint: 'Explorateur', icon: 'external', group: 'Actions', run: () => MF.api.app.openPath(null) },
      { id: 'toggle-animations', label: ui.animations === false ? 'Activer les animations' : 'Desactiver les animations', hint: 'Confort', icon: 'bolt', group: 'Reglages', run: async () => { await MF.state.setUi({ animations: ui.animations === false }); MF.router.reload(); } },
      { id: 'toggle-compact', label: ui.compact ? 'Desactiver la densite compacte' : 'Activer la densite compacte', hint: 'Confort', icon: 'list', group: 'Reglages', run: async () => { await MF.state.setUi({ compact: !ui.compact }); MF.router.reload(); } },
      { id: 'open-repo', label: 'Ouvrir le depot GitHub', hint: 'github.com/cameleonnbss', icon: 'code', group: 'Liens', run: () => MF.api.app.openExternal('https://github.com/cameleonnbss/MailForge') },
      { id: 'open-discord', label: 'Copier le contact Discord', hint: 'cameleonmortis', icon: 'at', group: 'Liens', run: () => MF.ui.copy('cameleonmortis', 'Pseudo Discord copie') },
      { id: 'clear-logs', label: 'Vider les journaux', hint: 'Maintenance', icon: 'trash', group: 'Reglages', run: async () => { await MF.api.logs.clear(); notify.ok('Journal vide'); MF.router.reload(); } }
    ];
  }

  async function exportConfig() {
    const payload = await MF.api.store.exportAll();
    await MF.ui.saveText(JSON.stringify(payload, null, 2), `mailforge-export-${Date.now()}.json`, [{ name: 'JSON', extensions: ['json'] }]);
  }

  async function exportHistory() {
    const content = await MF.api.history.export('csv');
    await MF.ui.saveText(content, 'mailforge-historique.csv', [{ name: 'CSV', extensions: ['csv'] }]);
  }

  function build() {
    const views = MF.router.list().map((view) => ({
      id: `view:${view.id}`,
      label: view.title,
      hint: view.description || '',
      icon: view.icon,
      group: view.group,
      run: () => MF.router.go(view.id)
    }));
    const accents = MF.state.ACCENTS.map((accent) => ({
      id: `accent:${accent.id}`,
      label: `Accent ${accent.label}`,
      hint: 'Apparence',
      icon: 'palette',
      group: 'Reglages',
      run: async () => {
        await MF.state.setAccent(accent.id);
        notify.ok('Accent applique', accent.label);
        MF.router.reload();
      }
    }));
    items = [...actions(), ...views, ...accents];
  }

  function score(item, query) {
    const haystack = `${item.label} ${item.hint} ${item.group}`.toLowerCase();
    if (!query) return 1;
    const needle = query.toLowerCase();
    if (haystack.includes(needle)) return 100 - haystack.indexOf(needle);
    let position = 0;
    for (const char of needle) {
      position = haystack.indexOf(char, position);
      if (position === -1) return 0;
      position += 1;
    }
    return 10;
  }

  function render() {
    const list = node.querySelector('[data-palette-list]');
    list.innerHTML = filtered.length
      ? filtered
          .map((item, index) => {
            const previous = filtered[index - 1];
            const header = !previous || previous.group !== item.group ? `<div class="nav-title" style="padding:8px 10px 4px">${esc(item.group || '')}</div>` : '';
            return `${header}
              <div class="palette-item ${index === cursor ? 'active' : ''}" data-index="${index}">
                ${svg(item.icon || 'chevron', 15)}
                <span>${esc(item.label)}</span>
                <span class="k">${esc(item.hint || '')}</span>
              </div>`;
          })
          .join('')
      : '<div class="hint" style="padding:14px">Aucun resultat.</div>';

    const active = list.querySelector('.palette-item.active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function filter(query) {
    filtered = items
      .map((item) => ({ item, value: score(item, query) }))
      .filter((entry) => entry.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 40)
      .map((entry) => entry.item);
    cursor = 0;
    render();
  }

  function close() {
    node.classList.remove('open');
    node.querySelector('input').value = '';
  }

  function execute(index) {
    const item = filtered[index ?? cursor];
    if (!item) return;
    close();
    setTimeout(() => item.run(), 10);
  }

  const palette = {
    open() {
      if (!node) return;
      build();
      node.classList.add('open');
      const input = node.querySelector('input');
      input.value = '';
      filter('');
      setTimeout(() => input.focus(), 20);
    },

    close,

    install() {
      const host = document.createElement('div');
      host.id = 'palette';
      host.innerHTML = `
        <div class="palette-box">
          <input type="text" placeholder="Rechercher une vue, une action, un reglage..." aria-label="Palette de commandes">
          <div class="palette-list" data-palette-list></div>
        </div>`;
      document.body.appendChild(host);
      node = host;

      const input = host.querySelector('input');
      input.addEventListener('input', () => filter(input.value.trim()));
      input.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          cursor = Math.min(cursor + 1, filtered.length - 1);
          render();
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          cursor = Math.max(cursor - 1, 0);
          render();
        } else if (event.key === 'Enter') {
          event.preventDefault();
          execute();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          close();
        }
      });
      host.addEventListener('mousedown', (event) => {
        if (event.target === host) close();
      });
      host.addEventListener('click', (event) => {
        const target = event.target.closest('.palette-item');
        if (target) execute(Number(target.dataset.index));
      });
    }
  };

  MF.palette = palette;
})();
