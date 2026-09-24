/* language: JavaScript, file: src/renderer/js/views/history.js
   Send history: every single send and campaign with its transport answer. */
(function () {
  const MF = (window.MF = window.MF || {});
  const { svg } = MF.icons;
  const { esc, notify, copy, saveText, number } = MF.ui;

  let rows = [];
  let filter = 'all';
  let search = '';

  function visible() {
    const needle = search.toLowerCase();
    return rows.filter((row) => {
      if (filter === 'ok' && row.ok !== true) return false;
      if (filter === 'failed' && row.ok !== false) return false;
      if (filter === 'campaign' && row.kind !== 'campaign') return false;
      if (filter === 'single' && row.kind === 'campaign') return false;
      if (!needle) return true;
      return `${row.to} ${row.subject} ${row.from || ''}`.toLowerCase().includes(needle);
    });
  }

  MF.router.register({
    id: 'history',
    title: 'Historique',
    group: 'Pilotage',
    icon: 'history',
    description: 'Journal des envois.',

    async preload() {
      rows = await MF.api.history.list({ limit: 300 });
    },

    render() {
      const list = visible();
      const stats = MF.state.get('stats', {});
      const success = rows.filter((row) => row.ok).length;
      return `
        <div class="page-head">
          <div class="titles">
            <h1>Historique des envois</h1>
            <p class="sub">Chaque entree conserve l'adresse, l'objet, l'identifiant de message renvoye par le serveur et le temps de reponse. Utile pour tracer un refus SMTP precis.</p>
          </div>
          <div class="actions">
            <button class="btn" data-export="csv">${svg('download', 15)} CSV</button>
            <button class="btn" data-export="json">${svg('download', 15)} JSON</button>
            <button class="btn danger" data-clear>${svg('trash', 15)} Vider</button>
          </div>
        </div>

        <div class="grid cols-3" style="margin-bottom:var(--s-5)">
          <div class="card stat-card"><div class="ico">${svg('send', 16)}</div><div class="stat"><div class="value">${number(stats.sentTotal)}</div><div class="legend">Messages acceptes</div></div></div>
          <div class="card stat-card"><div class="ico">${svg('error', 16)}</div><div class="stat"><div class="value">${number(stats.failedTotal)}</div><div class="legend">Echecs cumules</div></div></div>
          <div class="card stat-card"><div class="ico">${svg('chart', 16)}</div><div class="stat"><div class="value">${rows.length ? `${Math.round((success / rows.length) * 100)} %` : '—'}</div><div class="legend">Taux de succes local</div></div></div>
        </div>

        <div class="row" style="margin-bottom:var(--s-3)">
          <div class="tabs">
            ${[
              ['all', 'Tout'],
              ['ok', 'Reussis'],
              ['failed', 'Echecs'],
              ['single', 'Unitaires'],
              ['campaign', 'Campagnes']
            ]
              .map(([value, label]) => `<button class="tab ${filter === value ? 'active' : ''}" data-filter="${value}">${label}</button>`)
              .join('')}
          </div>
          <span class="spacer"></span>
          <label class="field" style="width:240px"><input type="search" data-search value="${esc(search)}" placeholder="Rechercher un destinataire ou un objet"></label>
        </div>

        ${list.length
          ? `<div class="table-wrap table-scroll">
              <table class="data">
                <thead><tr><th>Date</th><th>Type</th><th>Destinataire</th><th>Objet</th><th>Statut</th><th>Latence</th><th></th></tr></thead>
                <tbody>
                  ${list
                    .map(
                      (row, index) => `
                    <tr>
                      <td class="mono">${esc(MF.ui.date(row.ts))}</td>
                      <td>${row.kind === 'campaign' ? '<span class="pill accent">campagne</span>' : `<span class="pill">${esc(row.kind || 'unitaire')}</span>`}</td>
                      <td class="strong">${esc(String(row.to || '').slice(0, 42))}</td>
                      <td>${esc(String(row.subject || '').slice(0, 46))}</td>
                      <td>${row.ok ? '<span class="pill ok">accepte</span>' : `<span class="pill error">${esc(String(row.error || 'refus').slice(0, 30))}</span>`}</td>
                      <td class="num">${esc(String(row.ms || row.elapsedMs || '—'))}${row.ms ? ' ms' : ''}</td>
                      <td><div class="row-actions"><button class="btn ghost sm" data-detail="${index}">${svg('eye', 13)}</button></div></td>
                    </tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>`
          : MF.ui.empty('history', rows.length ? 'Aucun resultat' : 'Aucun envoi', rows.length ? 'Changez de filtre ou de recherche.' : 'Le premier message envoye apparaitra ici.')}`;
    },

    async mount({ host }) {
      MF.ui.onClick(host, '[data-filter]', (target) => {
        filter = target.dataset.filter;
        MF.router.reload();
      });

      const searchInput = host.querySelector('[data-search]');
      searchInput?.addEventListener('input', MF.ui.debounce((event) => {
        search = event.target.value;
        MF.router.reload();
      }, 300));

      MF.ui.onClick(host, '[data-detail]', (target) => {
        const row = visible()[Number(target.dataset.detail)];
        if (!row) return;
        const entries = Object.entries(row).filter(([, value]) => value !== null && value !== undefined && value !== '');
        MF.ui.modal({
          title: 'Detail de l\'envoi',
          body: `<div class="stack tight">${entries
            .map(([key, value]) => `<div class="kv"><span class="k">${esc(key)}</span><span class="v">${esc(Array.isArray(value) ? value.join(', ') : String(value))}</span></div>`)
            .join('')}</div>`,
          actions: [
            { label: 'Copier (JSON)', position: 'left', onClick: () => copy(JSON.stringify(row, null, 2), 'Entree copiee'), keepOpen: true },
            { label: 'Fermer' }
          ]
        });
      });

      MF.ui.onClick(host, '[data-export]', async (target) => {
        const format = target.dataset.export;
        const content = await MF.api.history.export(format);
        await saveText(content, `mailforge-historique.${format}`, [{ name: format.toUpperCase(), extensions: [format] }]);
      });

      MF.ui.onClick(host, '[data-clear]', async () => {
        const ok = await MF.ui.confirm({
          title: 'Vider l\'historique',
          message: 'Les compteurs cumules restent, la liste detaillee est effacee.',
          confirmLabel: 'Vider',
          kind: 'danger'
        });
        if (!ok) return;
        await MF.api.history.clear();
        rows = [];
        notify.ok('Historique vide');
        MF.router.reload();
      });
    }
  });
})();
