/* language: JavaScript, file: src/renderer/js/views/dashboard.js
   Home view: readiness banner, headline counters, module launcher, recent
   activity and a live tail of the log ring. */
(function () {
  const MF = (window.MF = window.MF || {});
  const { svg } = MF.icons;
  const { esc, number, relative, date, empty } = MF.ui;

  const MODULES = [
    { view: 'compose', icon: 'send', name: 'Compositeur', desc: 'Rediger et envoyer via SMTP ou API, piece jointe incluse.' },
    { view: 'campaign', icon: 'users', name: 'Campagne', desc: 'Liste consentie, envoi espace, suivi en direct.' },
    { view: 'tempmail', icon: 'inbox', name: 'Boite temporaire', desc: 'Adresse jetable, boite de reception et rafraichissement auto.' },
    { view: 'ai', icon: 'sparkles', name: 'Redaction IA', desc: 'Fournisseur gratuit ou local, langue et ton au choix.' },
    { view: 'templates', icon: 'template', name: 'Modeles', desc: 'Modeles reutilisables avec variables {{nom}}.' },
    { view: 'tools', icon: 'wrench', name: 'Boite a outils', desc: '16 generateurs, encodeurs, convertisseurs et analyseurs.' },
    { view: 'history', icon: 'history', name: 'Historique', desc: 'Chaque envoi, son identifiant et son temps de reponse.' },
    { view: 'logs', icon: 'terminal', name: 'Journaux', desc: 'Flux en direct, filtrable par niveau et exportable.' }
  ];

  function statCard(icon, value, unit, label, sub) {
    return `
      <article class="card stat-card">
        <div class="ico">${svg(icon, 16)}</div>
        <div class="stat">
          <div class="value">${value}${unit ? `<small>${esc(unit)}</small>` : ''}</div>
          <div class="legend">${esc(label)}</div>
        </div>
        ${sub ? `<div class="hint">${sub}</div>` : ''}
      </article>`;
  }

  MF.router.register({
    id: 'dashboard',
    title: 'Tableau de bord',
    group: 'Pilotage',
    icon: 'dashboard',
    description: 'Etat de la configuration et acces rapide aux modules.',

    render() {
      const store = MF.state.snapshot || {};
      const stats = store.stats || {};
      const history = store.history || [];
      const logs = (store.logs || []).slice(-8).reverse();
      const profiles = store.smtp?.profiles || [];
      const boxes = store.tempmail?.boxes || [];
      const aiProviders = store.ai?.providers || [];
      const today = history.filter((row) => row.ts?.slice(0, 10) === new Date().toISOString().slice(0, 10));
      const failed = history.filter((row) => row.ok === false);
      const successRate = history.length ? Math.round(((history.length - failed.length) / history.length) * 100) : null;

      const readiness = [];
      if (!profiles.length) {
        readiness.push({
          kind: 'warn',
          text: `Aucun profil d'envoi configure — le compositeur et les campagnes resteront inactifs.`,
          action: { label: 'Configurer', view: 'settings', params: { tab: 'send' } }
        });
      } else {
        readiness.push({ kind: 'ok', text: `${profiles.length} profil(s) d'envoi — actif : <strong>${esc(profiles.find((p) => p.id === store.smtp.activeProfileId)?.label || profiles[0].label)}</strong>` });
      }
      if (!aiProviders.some((provider) => provider.apiKey)) {
        readiness.push({ kind: 'info', text: 'Aucune cle IA enregistree — la redaction assistee est optionnelle et se configure en une ligne.', action: { label: 'Ajouter une cle', view: 'ai' } });
      }

      return `
        <div class="hero">
          <h1>MailForge</h1>
          <p class="lede">Poste de travail e-mail : composer, envoyer a une liste consentie, ouvrir des boites jetables et seize outils — dans une seule fenetre.</p>
          <div class="hero-actions">
            <button class="btn primary lg" data-go="compose">${svg('send', 15)} Nouveau message</button>
            <button class="btn lg" data-go="campaign">${svg('users', 15)} Lancer une campagne</button>
            <button class="btn lg" data-go="tempmail">${svg('inbox', 15)} Boite temporaire</button>
            <button class="btn ghost lg" data-palette>${svg('search', 15)} Tout trouver <span class="kbd">Ctrl K</span></button>
          </div>
          <div class="hero-meta">
            <div><div class="k">Envoyes au total</div><div class="v">${number(stats.sentTotal)}</div></div>
            <div><div class="k">Aujourd'hui</div><div class="v">${number(today.length)}</div></div>
            <div><div class="k">Taux de succes</div><div class="v">${successRate === null ? '—' : `${successRate} %`}</div></div>
            <div><div class="k">Boites jetables</div><div class="v">${number(stats.tempMailboxes)}</div></div>
            <div><div class="k">Volume transmis</div><div class="v">${MF.ui.bytes(stats.bytesSent)}</div></div>
          </div>
        </div>

        <div class="stack" style="margin-top:var(--s-5)">
          ${readiness
            .map(
              (item) => `
            <div class="banner ${item.kind}">
              ${svg(item.kind === 'ok' ? 'check' : item.kind === 'warn' ? 'alert' : 'info', 16)}
              <div style="flex:1">${item.text}</div>
              ${item.action ? `<button class="btn sm" data-go="${item.action.view}" ${item.action.params ? `data-go-params='${JSON.stringify(item.action.params)}'` : ''}>${esc(item.action.label)}</button>` : ''}
            </div>`
            )
            .join('')}
        </div>

        <div class="grid cols-3" style="margin-top:var(--s-5)">
          ${statCard('send', number(stats.sentTotal), 'messages', 'Envoyes au total', `${number(today.length)} aujourd'hui`)}
          ${statCard('error', number(stats.failedTotal), 'echecs', 'Echecs cumules', history.length ? `${failed.length} sur les ${history.length} derniers` : 'aucun envoi enregistre')}
          ${statCard('inbox', number(boxes.length), 'boites', 'Boites actives', `${number(stats.tempMailboxes)} creees au total`)}
          ${statCard('database', MF.ui.bytes(stats.bytesSent), '', 'Volume transmis', 'pieces jointes incluses')}
        </div>

        <div class="split" style="margin-top:var(--s-6)">
          <section>
            <div class="section-head"><span class="title">Modules</span><span class="hint">${MODULES.length} raccourcis</span></div>
            <div class="grid tight">
              ${MODULES.map(
                (module) => `
                <button class="module" data-go="${module.view}">
                  <span class="ico">${svg(module.icon, 15)}</span>
                  <span class="txt">
                    <span class="n">${esc(module.name)}</span>
                    <span class="d">${esc(module.desc)}</span>
                  </span>
                </button>`
              ).join('')}
            </div>
          </section>

          <aside class="stack">
            <div class="card">
              <header><span class="title">${svg('history', 15)} Activite recente</span>${history.length ? `<button class="btn ghost sm" data-go="history">Tout voir</button>` : ''}</header>
              ${history.length
                ? history
                    .slice(0, 6)
                    .map(
                      (row) => `
                  <div class="activity-row">
                    <span class="dot ${row.ok ? 'ok' : 'error'}"></span>
                    <span class="who">${esc(String(row.to || '').slice(0, 34))}</span>
                    <span class="what">${esc(String(row.subject || '').slice(0, 30))}</span>
                    <span class="when">${row.ok ? `+${row.ms || row.elapsedMs || 0} ms` : 'echec'}</span>
                  </div>`
                    )
                    .join('')
                : empty('history', 'Aucun envoi', "L'historique se remplit des le premier message.")}
            </div>

            <div class="card">
              <header><span class="title">${svg('terminal', 15)} Journal en direct</span><span class="pill ${MF.state.get('ui.animations', true) ? 'ok' : ''}"><span class="dot live"></span>tail</span></header>
              <div class="log-view" data-log-tail style="height:190px">
                ${logs.length
                  ? logs
                      .map(
                        (row) => `<div class="log-line ${esc(row.level)}"><span class="ts">${esc(MF.ui.time(row.ts))}</span><span class="lvl">${esc(row.level.toUpperCase())}</span><span class="msg">${esc(row.message)}</span></div>`
                      )
                      .join('')
                  : empty('terminal', 'Journal vide')}
              </div>
            </div>
          </aside>
        </div>`;
    },

    mount({ host }) {
      MF.ui.onClick(host, '[data-go]', (target) => {
        const params = target.dataset.goParams ? JSON.parse(target.dataset.goParams) : {};
        MF.router.go(target.dataset.go, params);
      });
      MF.ui.onClick(host, '[data-palette]', () => MF.palette.open());

      const tail = host.querySelector('[data-log-tail]');
      if (tail) {
        tail.scrollTop = tail.scrollHeight;
        this.unsubscribe = MF.api.onEvent(({ type, payload }) => {
          if (type !== 'log' || !tail.isConnected) return;
          const line = document.createElement('div');
          line.className = `log-line ${payload.level}`;
          line.innerHTML = `<span class="ts">${esc(MF.ui.time(payload.ts || Date.now()))}</span><span class="lvl">${esc(String(payload.level).toUpperCase())}</span><span class="msg">${esc(payload.message)}</span>`;
          tail.appendChild(line);
          while (tail.childElementCount > 40) tail.firstElementChild.remove();
          tail.scrollTop = tail.scrollHeight;
        });
      }
    },

    unmount() {
      if (this.unsubscribe) this.unsubscribe();
    }
  });
})();
