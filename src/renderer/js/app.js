/* language: JavaScript, file: src/renderer/js/app.js
   Boot: window chrome, sidebar navigation, keyboard shortcuts and the event
   stream coming from the main process. */
(function () {
  const MF = (window.MF = window.MF || {});
  const { svg } = MF.icons;
  const { esc, notify } = MF.ui;

  const MAX_RING = 400;
  const ring = [];

  function chrome() {
    const titlebar = document.getElementById('titlebar');
    titlebar.innerHTML = `
      <div class="brand">
        ${svg('stamp', 19)}
        <span>MailForge</span>
        <span class="tag">toolkit</span>
      </div>
      <div class="titlebar-drag"></div>
      <div class="titlebar-status">
        <span class="pill" data-status-profile>${svg('database', 12)} <span>chargement...</span></span>
        <span class="pill" data-status-log>${svg('terminal', 12)} <span>0</span></span>
      </div>
      <div class="titlebar-actions">
        <button class="win-btn" data-win="minimize" title="Reduire">${svg('minimize', 11)}</button>
        <button class="win-btn" data-win="maximize" title="Agrandir">${svg('maximize', 11)}</button>
        <button class="win-btn close" data-win="close" title="Fermer">${svg('close', 11)}</button>
      </div>`;

    MF.ui.onClick(titlebar, '[data-win]', async (target) => {
      const action = target.dataset.win;
      if (action === 'minimize') await MF.api.window.minimize();
      else if (action === 'maximize') {
        const maximized = await MF.api.window.toggleMaximize();
        target.innerHTML = svg(maximized ? 'restore' : 'maximize', 11);
      } else if (action === 'close') await MF.api.window.close();
    });

    titlebar.addEventListener('dblclick', async (event) => {
      if (event.target.closest('[data-win]')) return;
      const maximized = await MF.api.window.toggleMaximize();
      titlebar.querySelector('[data-win="maximize"]').innerHTML = svg(maximized ? 'restore' : 'maximize', 11);
    });
  }

  function sidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.innerHTML = `
      ${MF.router
        .groups()
        .map(
          ([group, views]) => `
        <div class="nav-group">
          <div class="nav-title">${esc(group)}</div>
          ${views
            .map(
              (view) => `<button class="nav-item" data-nav="${esc(view.id)}" title="${esc(view.title)}">
                ${svg(view.icon, 16)}
                <span>${esc(view.title)}</span>
                <span class="badge" data-badge="${esc(view.id)}" hidden></span>
              </button>`
            )
            .join('')}
        </div>`
        )
        .join('')}
      <div class="sidebar-foot">
        <button class="nav-item" data-palette-open>${svg('search', 16)}<span>Rechercher</span><span class="badge">Ctrl K</span></button>
        <div class="side-note hint" style="padding:0 var(--s-3)">
          <div class="row between" style="font-size:10.5px">
            <span data-version>v1.0.0</span>
            <span class="mono" data-platform></span>
          </div>
        </div>
      </div>`;

    MF.ui.onClick(sidebar, '[data-nav]', (target) => MF.router.go(target.dataset.nav));
    MF.ui.onClick(sidebar, '[data-palette-open]', () => MF.palette.open());
  }

  function markActive(view) {
    document.querySelectorAll('[data-nav]').forEach((node) => {
      node.classList.toggle('active', node.dataset.nav === view.id);
    });
  }

  function shortcuts() {
    document.addEventListener('keydown', (event) => {
      const mod = event.ctrlKey || event.metaKey;
      const typing = /^(INPUT|TEXTAREA)$/.test(event.target.tagName) || event.target.isContentEditable;

      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        MF.palette.open();
        return;
      }
      if (event.key === 'Escape') {
        if (document.getElementById('palette')?.classList.contains('open')) MF.palette.close();
        return;
      }
      if (!mod) return;

      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        MF.router.go('compose');
        return;
      }
      if (event.key.toLowerCase() === 'r') {
        event.preventDefault();
        MF.router.reload();
        return;
      }
      if (/^[1-9]$/.test(event.key)) {
        const views = MF.router.list().filter((view) => ['dashboard', 'compose', 'campaign', 'tempmail', 'ai', 'templates', 'snippets', 'tools', 'settings'].includes(view.id));
        const target = views[Number(event.key) - 1];
        if (target) {
          event.preventDefault();
          MF.router.go(target.id);
        }
      }
      if (mod && event.key === 'Enter' && typing) {
        /* views wire their own Ctrl+Enter; nothing global to do */
      }
    });
  }

  function statusBar() {
    const logPill = document.querySelector('[data-status-log] span');
    const profilePill = document.querySelector('[data-status-profile] span');
    const refresh = () => {
      const store = MF.state.snapshot || {};
      const profile = (store.smtp?.profiles || []).find((item) => item.id === store.smtp.activeProfileId) || store.smtp?.profiles?.[0];
      if (profilePill) profilePill.textContent = profile ? profile.label : 'aucun profil';
    };
    MF.state.subscribe(refresh);
    refresh();
    return (entry) => {
      ring.push(entry);
      if (ring.length > MAX_RING) ring.shift();
      if (logPill) logPill.textContent = String(ring.length);
    };
  }

  async function boot() {
    MF.palette.install();
    chrome();
    sidebar();
    shortcuts();

    const pushLog = statusBar();
    MF.api.setLogSink(pushLog);

    const info = await MF.api.app.info();
    const version = document.querySelector('[data-version]');
    const platform = document.querySelector('[data-platform]');
    if (version) version.textContent = `v${info.version}`;
    if (platform) platform.textContent = info.packaged ? 'installe' : 'dev';
    MF.api.log('info', `MailForge ${info.version} demarre (${info.arch})`, 'app');

    MF.router.onChange(markActive);
    MF.router.start(document.getElementById('view-host'));

    MF.api.onEvent(({ type, payload }) => {
      if (type === 'log') {
        pushLog(payload);
        return;
      }
      if (type === 'bulk:done') {
        notify[payload.failed ? 'warn' : 'ok'](
          'Campagne terminee',
          `${payload.sent} envoye(s), ${payload.failed} echec(s) en ${MF.ui.duration(payload.elapsedMs)}`
        );
      }
    });

    if (MF.api.isMock) {
      notify.warn('Mode apercu', "Le pont Electron n'est pas charge : les donnees sont simulees et rien n'est envoye.");
    }
  }

  MF.app = { boot, ring };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => MF.state.load().then(boot).catch(reportFatal));
  else MF.state.load().then(boot).catch(reportFatal);

  function reportFatal(error) {
    document.body.innerHTML = `<div style="padding:40px;font-family:system-ui;color:#e9eef8">
      <h1 style="font-size:20px">Echec du demarrage</h1>
      <pre style="white-space:pre-wrap;color:#fb7185">${esc(error.message)}\n${esc(error.stack || '')}</pre>
    </div>`;
  }
})();
