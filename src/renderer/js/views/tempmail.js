/* language: JavaScript, file: src/renderer/js/views/tempmail.js
   Temporary mailboxes: provider selection, address creation, inbox polling with
   auto-refresh, message reader. Providers come from a registry in the main
   process, so adding a backend needs no change here. */
(function () {
  const MF = (window.MF = window.MF || {});
  const { svg } = MF.icons;
  const { esc, notify, copy, relative } = MF.ui;

  const local = {
    providers: [],
    activeProvider: 'mailtm',
    boxes: [],
    activeBoxId: null,
    messages: [],
    openMessage: null,
    timer: null,
    busy: false
  };

  function providerCard(provider) {
    const active = local.activeProvider === provider.id;
    return `
      <button class="module" data-provider="${esc(provider.id)}" style="${active ? 'border-color:var(--line-accent);background:var(--accent-soft)' : ''}">
        <span class="ico">${svg('inbox', 14)}</span>
        <span class="txt">
          <span class="n">${esc(provider.label)} ${active ? '<span class="pill accent" style="margin-left:6px">actif</span>' : ''}</span>
          <span class="d">${esc(provider.description)}${provider.stable ? '' : ' · API publique, fiabilite variable.'}</span>
        </span>
      </button>`;
  }

  function boxList() {
    if (!local.boxes.length) return MF.ui.empty('inbox', 'Aucune boite', 'Creez une adresse jetable pour commencer.');
    return local.boxes
      .map(
        (box) => `
      <button class="mail-item ${box.id === local.activeBoxId ? 'active' : ''}" data-box="${esc(box.id)}">
        <span class="top">
          <span class="from">${esc(box.address)}</span>
          <span class="date">${box.provider}</span>
        </span>
        <span class="subject">${box.received ? `${box.received} message(s)` : 'boite vide'}</span>
        <span class="snippet">creee ${esc(relative(box.createdAt))}</span>
      </button>`
      )
      .join('');
  }

  function messageList() {
    if (!local.activeBoxId) return MF.ui.empty('mail', 'Aucune boite selectionnee');
    if (!local.messages.length) return MF.ui.empty('mail', 'Aucun message', "Un rafraichissement automatique est actif tant que cette vue est ouverte.");
    return local.messages
      .map(
        (message) => `
      <button class="mail-item ${local.openMessage?.id === message.id ? 'active' : ''}" data-message="${esc(message.id)}" style="background:none;border:none;border-bottom:1px solid rgba(148,163,184,.08);width:100%;text-align:left">
        <span class="top">
          <span class="from">${esc(message.from.address || message.from.name || 'inconnu')}</span>
          <span class="date">${esc(relative(message.date))}</span>
        </span>
        <span class="subject">${esc(message.subject)}</span>
        <span class="snippet">${esc(message.snippet || '')}</span>
      </button>`
      )
      .join('');
  }

  function reader() {
    if (!local.openMessage) {
      return MF.ui.empty('mail', 'Selectionnez un message', 'Le contenu brut est affiche ici, dans un cadre isole.');
    }
    const message = local.openMessage;
    const html = message.html && /<[a-z]/i.test(message.html) ? message.html : `<pre style="white-space:pre-wrap;font-family:inherit">${esc(message.text || '')}</pre>`;
    return `
      <header>
        <div class="subject">${esc(message.subject)}</div>
        <div class="from">De <strong>${esc(message.from.address || message.from.name)}</strong> · ${esc(MF.ui.date(message.date))}</div>
        <div class="row" style="margin-top:6px">
          <button class="btn ghost sm" data-copy-from>${svg('copy', 13)} Copier l'expediteur</button>
          <button class="btn ghost sm" data-reply>${svg('send', 13)} Repondre depuis le compositeur</button>
        </div>
      </header>
      <div class="body">
        <iframe sandbox srcdoc="${MF.ui.attr(`<html><body style="font-family:Segoe UI,sans-serif;font-size:13.5px;line-height:1.6;color:#111;padding:14px">${html}</body></html>`)}"></iframe>
      </div>`;
  }

  MF.router.register({
    id: 'tempmail',
    title: 'Boite temporaire',
    group: 'Boites',
    icon: 'inbox',
    description: 'Adresse jetable et boite de reception.',

    async preload() {
      const payload = await MF.api.tempmail.providers();
      local.providers = payload.providers;
      local.activeProvider = payload.activeProvider;
      local.boxes = await MF.api.tempmail.boxes();
      if (!local.boxes.some((item) => item.id === local.activeBoxId)) {
        local.activeBoxId = local.boxes[0]?.id || null;
        local.messages = [];
        local.openMessage = null;
      }
      if (local.activeBoxId && !local.messages.length) {
        local.messages = await MF.api.tempmail.poll(local.activeBoxId).catch(() => []);
      }
    },

    render() {
      const box = local.boxes.find((item) => item.id === local.activeBoxId);
      const autoRefresh = MF.state.get('tempmail.autoRefreshSec', 12);
      return `
        <div class="page-head">
          <div class="titles">
            <h1>Boite temporaire</h1>
            <p class="sub">Adresse jetable pour recevoir un lien de confirmation, un code ou un test d'inscription. Les fournisseurs utilisent leur API publique officielle quand elle existe.</p>
          </div>
          <div class="actions">
            <span class="pill ${local.timer ? 'ok' : ''}"><span class="dot ${local.timer ? 'live' : ''}"></span>${local.timer ? `auto ${autoRefresh} s` : 'auto inactif'}</span>
            <button class="btn primary" data-create>${svg('plus', 15)} Nouvelle adresse</button>
          </div>
        </div>

        <div class="card" style="margin-bottom:var(--s-4)">
          <header><span class="title">${svg('database', 15)} Fournisseur</span><span class="hint">Architecture prete pour en ajouter d'autres : un fichier par backend.</span></header>
          <div class="grid tight">${local.providers.map(providerCard).join('')}</div>
        </div>

        <div class="inbox-grid">
          <div class="stack">
            <div class="card">
              <header><span class="title">${svg('inbox', 15)} Vos boites</span><span class="pill">${local.boxes.length}</span></header>
              <div class="mail-list" style="max-height:320px">${boxList()}</div>
              ${local.boxes.length ? `<button class="btn ghost sm block" style="margin-top:var(--s-3)" data-forget>${svg('trash', 14)} Oublier toutes les boites locales</button>` : ''}
            </div>

            <div class="card flat">
              <header><span class="title">${svg('shield', 15)} A savoir</span></header>
              <p class="hint">Une boite jetable est publique par nature : ne faites jamais transiter d'information sensible ou personnelle. Les fournisseurs sans authentification (Maildrop) exposent l'adresse a quiconque la devine.</p>
            </div>
          </div>

          <div class="stack">
            ${box
              ? `
              <div class="address-bar">
                ${svg('at', 15)}
                <span style="flex:1">${esc(box.address)}</span>
                <button class="btn sm" data-copy-address>${svg('copy', 13)} Copier</button>
                <button class="btn sm" data-refresh>${svg('refresh', 13)} Actualiser</button>
                <button class="btn sm danger" data-delete-box>${svg('trash', 13)}</button>
              </div>`
              : `<div class="banner">${svg('info', 16)}<div>Creez une adresse pour voir sa boite de reception. Une boite s'affiche ici avec sa liste de messages et un rafraichissement automatique.</div></div>`}

            <div class="inbox-grid" style="grid-template-columns:260px minmax(0,1fr)">
              <div class="mail-list">${messageList()}</div>
              <div class="mail-reader">${reader()}</div>
            </div>
          </div>
        </div>`;
    },

    async mount({ host }) {
      this.unsubs = [];
      startAutoRefresh(host);

      MF.ui.onClick(host, '[data-provider]', async (target) => {
        local.activeProvider = await MF.api.tempmail.setProvider(target.dataset.provider);
        notify.ok('Fournisseur actif', local.providers.find((item) => item.id === local.activeProvider)?.label || '');
        MF.router.reload();
      });

      MF.ui.onClick(host, '[data-create]', async (target) => {
        MF.ui.busy(target, true);
        target.dataset.busyLabel = 'Creation...';
        const box = await MF.api.tempmail.create(local.activeProvider).catch(() => null);
        MF.ui.busy(target, false);
        if (!box) return;
        local.boxes = await MF.api.tempmail.boxes();
        local.activeBoxId = box.id;
        local.messages = [];
        local.openMessage = null;
        notify.ok('Adresse creee', box.address);
        MF.router.reload();
      });

      MF.ui.onClick(host, '[data-box]', async (target) => {
        local.activeBoxId = target.dataset.box;
        local.openMessage = null;
        await refreshBox(host, { silent: true });
        MF.router.reload();
      });

      MF.ui.onClick(host, '[data-refresh]', () => refreshBox(host));
      MF.ui.onClick(host, '[data-copy-address]', () => {
        const box = local.boxes.find((item) => item.id === local.activeBoxId);
        if (box) copy(box.address, 'Adresse copiee');
      });

      MF.ui.onClick(host, '[data-delete-box]', async () => {
        const box = local.boxes.find((item) => item.id === local.activeBoxId);
        if (!box) return;
        const ok = await MF.ui.confirm({ title: 'Supprimer la boite', message: `Supprimer ${box.address} ?`, confirmLabel: 'Supprimer', kind: 'danger' });
        if (!ok) return;
        await MF.api.tempmail.destroy(box.id);
        local.boxes = await MF.api.tempmail.boxes();
        local.activeBoxId = local.boxes[0]?.id || null;
        local.messages = [];
        local.openMessage = null;
        notify.ok('Boite supprimee');
        MF.router.reload();
      });

      MF.ui.onClick(host, '[data-forget]', async () => {
        const ok = await MF.ui.confirm({ title: 'Oublier les boites', message: 'Retirer toutes les boites de la liste locale ? Les messages distants ne sont pas supprimes.', confirmLabel: 'Oublier', kind: 'danger' });
        if (!ok) return;
        await MF.api.tempmail.forgetAll();
        local.boxes = [];
        local.activeBoxId = null;
        local.messages = [];
        MF.router.reload();
      });

      MF.ui.onClick(host, '[data-message]', async (target) => {
        local.openMessage = await MF.api.tempmail.read(local.activeBoxId, target.dataset.message).catch(() => null);
        MF.router.reload();
      });

      MF.ui.onClick(host, '[data-copy-from]', () => copy(local.openMessage?.from?.address || '', 'Expediteur copie'));
      MF.ui.onClick(host, '[data-reply]', () => {
        if (!local.openMessage) return;
        MF.state.handoff = {
          subject: local.openMessage.subject.startsWith('Re:') ? local.openMessage.subject : `Re: ${local.openMessage.subject}`,
          html: `<p></p><p style="color:#8a93a5;font-size:12px">— Message d'origine de ${esc(local.openMessage.from.address)} —</p>`
        };
        MF.router.go('compose');
      });
    },

    unmount() {
      clearInterval(local.timer);
      local.timer = null;
      (this.unsubs || []).forEach((fn) => fn());
    }
  });

  async function refreshBox(host, { silent = false } = {}) {
    if (!local.activeBoxId || local.busy) return;
    local.busy = true;
    try {
      const messages = await MF.api.tempmail.poll(local.activeBoxId);
      const changed = messages.length !== local.messages.length;
      local.messages = messages;
      local.boxes = await MF.api.tempmail.boxes();
      if (changed && !silent && messages.length) {
        notify.info(`${messages.length} message(s)`, 'Nouvelle boite de reception mise a jour.');
      }
      if (host.isConnected && changed) MF.router.reload();
      return messages;
    } catch (error) {
      if (!silent) notify.error('Releve impossible', error.message);
    } finally {
      local.busy = false;
    }
  }

  function startAutoRefresh(host) {
    clearInterval(local.timer);
    const seconds = Math.max(5, Number(MF.state.get('tempmail.autoRefreshSec', 12)) || 12);
    local.timer = setInterval(() => {
      if (!local.activeBoxId) return;
      if (document.querySelector('[data-view="tempmail"]')) refreshBox(host, { silent: true });
    }, seconds * 1000);
  }
})();
