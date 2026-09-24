/* language: JavaScript, file: src/renderer/js/views/ai.js
   AI drafting: provider catalog with free tiers, key storage, defaults and a
   standalone drafting bench that hands the result to the composer. */
(function () {
  const MF = (window.MF = window.MF || {});
  const { svg } = MF.icons;
  const { esc, notify, copy } = MF.ui;

  const local = {
    providers: [],
    activeProviderId: 'groq',
    result: null,
    openEditor: null
  };

  function providerRow(provider) {
    const isActive = local.activeProviderId === provider.id;
    const open = local.openEditor === provider.id;
    return `
      <div class="card ${isActive ? 'accent' : 'flat'}" style="padding:var(--s-3)">
        <div class="row between">
          <div class="row" style="gap:var(--s-3);min-width:0">
            <span class="ico" style="width:30px;height:30px;display:grid;place-items:center;border-radius:9px;background:rgba(148,163,184,.1);color:var(--accent-text)">${svg(provider.free ? 'heart' : 'bolt', 15)}</span>
            <div style="min-width:0">
              <div style="font-weight:570;color:var(--text-1)">
                ${esc(provider.label)}
                ${provider.free ? '<span class="pill ok" style="margin-left:6px">gratuit</span>' : ''}
                ${provider.local ? '<span class="pill info" style="margin-left:6px">local</span>' : ''}
                ${isActive ? '<span class="pill accent" style="margin-left:6px">actif</span>' : ''}
                ${provider.configured ? '<span class="pill ok" style="margin-left:6px">cle enregistree</span>' : ''}
              </div>
              <div class="hint">${esc(provider.note || '')}</div>
              <div class="hint mono" style="font-size:10.5px">${esc(provider.baseUrl || '(vide)')} · ${esc(provider.model || 'modele a definir')}</div>
            </div>
          </div>
          <div class="row" style="flex:none">
            ${provider.keyUrl ? `<button class="btn ghost sm" data-open-key="${esc(provider.keyUrl)}">${svg('external', 13)} Obtenir une cle</button>` : ''}
            <button class="btn sm" data-configure="${esc(provider.id)}">${open ? 'Fermer' : 'Configurer'}</button>
            <button class="btn sm ${isActive ? '' : 'primary'}" data-activate="${esc(provider.id)}" ${isActive ? 'disabled' : ''}>${isActive ? 'Actif' : 'Activer'}</button>
          </div>
        </div>

        ${open ? `
        <div class="stack tight" style="margin-top:var(--s-3);border-top:1px solid var(--line);padding-top:var(--s-3)">
          <label class="field">
            <span class="label">Cle API ${provider.local ? '(inutile en local)' : ''}</span>
            <input type="password" data-key placeholder="${provider.configured ? 'cle enregistree — laisser vide pour conserver' : 'collez la cle ici'}" data-autofocus>
          </label>
          <div class="row" style="gap:var(--s-3);align-items:flex-end">
            <label class="field" style="flex:1;min-width:180px">
              <span class="label">Modele</span>
              <input type="text" data-model value="${esc(provider.model || '')}" placeholder="identifiant du modele">
            </label>
            <label class="field" style="flex:1;min-width:220px">
              <span class="label">URL de base</span>
              <input type="text" data-base-url value="${esc(provider.baseUrl || '')}" placeholder="https://api.exemple.com/v1">
            </label>
          </div>
          <div class="row">
            <button class="btn primary sm" data-save="${esc(provider.id)}">${svg('save', 14)} Enregistrer</button>
            <button class="btn sm" data-test="${esc(provider.id)}">${svg('bolt', 14)} Tester</button>
            <span class="hint">La cle est chiffree au repos (AES-256-GCM) dans le dossier de donnees de l'application.</span>
          </div>
        </div>` : ''}
      </div>`;
  }

  MF.router.register({
    id: 'ai',
    title: 'Redaction IA',
    group: 'E-mail',
    icon: 'sparkles',
    description: 'Fournisseurs gratuits ou locaux pour rediger les messages.',

    async preload() {
      const payload = await MF.api.ai.catalog();
      local.providers = payload.providers;
      local.activeProviderId = payload.activeProviderId;
    },

    render() {
      return `
        <div class="page-head">
          <div class="titles">
            <h1>Redaction IA</h1>
            <p class="sub">Optionnel et interchangeable : branchez un palier gratuit ou un modele local, gardez le controle du contenu. Rien ne part tant que vous ne cliquez pas.</p>
          </div>
          <div class="actions">
            <span class="pill accent">${svg('sparkles', 12)} actif : ${esc(local.providers.find((p) => p.id === local.activeProviderId)?.label || '—')}</span>
            <button class="btn ghost" data-go="compose">${svg('send', 15)} Aller au compositeur</button>
          </div>
        </div>

        <div class="banner" style="margin-bottom:var(--s-4)">
          ${svg('info', 16)}
          <div>Les fournisseurs marques <strong>gratuit</strong> exposent un palier d'usage sans frais, sous reserve de leurs conditions. Ollama et LM Studio tournent en local : aucune donnee ne quitte la machine et aucune cle n'est necessaire.</div>
        </div>

        <div class="split">
          <div class="stack">
            <div class="section-head"><span class="title">Fournisseurs</span><span class="hint">${local.providers.length} disponibles</span></div>
            ${local.providers.map(providerRow).join('')}
          </div>

          <aside class="stack">
            <div class="card accent">
              <header><span class="title">${svg('wand', 15)} Atelier de redaction</span></header>
              <label class="field">
                <span class="label">Intention</span>
                <textarea data-brief rows="4" placeholder="Demande de report d'une reunion, nouveau creneau propose, ton ferme mais courtois"></textarea>
              </label>
              <div class="row" style="gap:var(--s-2)">
                <label class="field" style="flex:1">
                  <span class="label">Langue</span>
                  <select data-lang>${['fr', 'en', 'es', 'de', 'it', 'pt', 'nl'].map((l) => `<option value="${l}" ${MF.state.get('ai.language', 'fr') === l ? 'selected' : ''}>${l.toUpperCase()}</option>`).join('')}</select>
                </label>
                <label class="field" style="flex:1">
                  <span class="label">Ton</span>
                  <select data-tone>${['professionnel', 'cordial', 'direct', 'commercial', 'technique', 'ferme'].map((t) => `<option value="${t}" ${MF.state.get('ai.tone') === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
                </label>
              </div>
              <label class="field" style="margin-top:var(--s-2)">
                <span class="label">Consignes permanentes</span>
                <input type="text" data-instructions value="${esc(MF.state.get('ai.customInstructions', ''))}" placeholder="ex : toujours proposer un creneau de 15 minutes">
              </label>
              <button class="btn primary block" data-generate style="margin-top:var(--s-3)">${svg('wand', 15)} Generer</button>
            </div>

            <div data-result>${local.result ? resultBlock(local.result) : ''}</div>

            <div class="card flat">
              <header><span class="title">${svg('info', 15)} Bon usage</span></header>
              <p class="hint">Un brouillon genere est un point de depart : relisez, corrigez les faits, verifiez les liens et les chiffres. Vous restez l'expediteur.</p>
            </div>
          </aside>
        </div>`;
    },

    async mount({ host }) {
      MF.ui.onClick(host, '[data-go]', (target) => MF.router.go(target.dataset.go));
      MF.ui.onClick(host, '[data-open-key]', (target) => MF.api.app.openExternal(target.dataset.openKey));
      MF.ui.onClick(host, '[data-configure]', (target) => {
        local.openEditor = local.openEditor === target.dataset.configure ? null : target.dataset.configure;
        MF.router.reload();
      });
      MF.ui.onClick(host, '[data-activate]', async (target) => {
        local.activeProviderId = await MF.api.ai.setActive(target.dataset.activate);
        notify.ok('Fournisseur actif', local.providers.find((p) => p.id === local.activeProviderId)?.label || '');
        MF.router.reload();
      });

      MF.ui.onClick(host, '[data-save]', async (target) => {
        const card = target.closest('.card');
        const key = card.querySelector('[data-key]').value.trim();
        const model = card.querySelector('[data-model]').value.trim();
        const baseUrl = card.querySelector('[data-base-url]').value.trim();
        await MF.api.ai.saveProvider({ id: target.dataset.save, apiKey: key, model, baseUrl });
        notify.ok('Fournisseur enregistre', model || 'modele par defaut');
        local.openEditor = null;
        MF.router.reload();
      });

      MF.ui.onClick(host, '[data-test]', async (target) => {
        MF.ui.busy(target, true);
        target.dataset.busyLabel = 'Test...';
        const result = await MF.api.ai.test({ providerId: target.dataset.test }).catch(() => null);
        MF.ui.busy(target, false);
        if (!result) return;
        notify[result.ok ? 'ok' : 'error'](result.ok ? `Reponse en ${result.ms} ms` : 'Test echoue', result.message);
      });

      MF.ui.onClick(host, '[data-generate]', async (target) => {
        const brief = host.querySelector('[data-brief]').value.trim();
        if (!brief) {
          notify.warn('Decrivez ce que le message doit dire');
          return;
        }
        await MF.state.merge({
          ai: {
            language: host.querySelector('[data-lang]').value,
            tone: host.querySelector('[data-tone]').value,
            customInstructions: host.querySelector('[data-instructions]').value
          }
        });
        MF.ui.busy(target, true);
        target.dataset.busyLabel = 'Generation...';
        const result = await MF.api.ai
          .draft({
            brief,
            language: host.querySelector('[data-lang]').value,
            tone: host.querySelector('[data-tone]').value,
            length: MF.state.get('ai.length', 'moyen'),
            context: host.querySelector('[data-instructions]').value
          })
          .catch(() => null);
        MF.ui.busy(target, false);
        if (!result) return;
        local.result = result;
        host.querySelector('[data-result]').innerHTML = resultBlock(result);
        notify.ok(`Brouillon genere via ${result.provider}`, result.notes || '');
      });

      MF.ui.onClick(host, '[data-copy-draft]', () => {
        if (local.result) copy(local.result.text || local.result.html, 'Brouillon copie');
      });
      MF.ui.onClick(host, '[data-to-compose]', () => {
        if (!local.result) return;
        MF.state.handoff = { subject: local.result.subject, html: local.result.html };
        MF.router.go('compose');
      });
    }
  });

  function resultBlock(result) {
    return `
      <div class="card">
        <header>
          <span class="title">${svg('sparkles', 15)} Brouillon</span>
          <span class="pill accent">${esc(result.provider || '')} ${result.usage?.total_tokens ? `· ${result.usage.total_tokens} tokens` : ''}</span>
        </header>
        <div class="stack tight">
          <div class="kv"><span class="k">Objet propose</span><span class="v">${esc(result.subject || '—')}</span></div>
          <pre class="code">${esc(result.text || result.html || '')}</pre>
          ${result.notes ? `<div class="hint">${esc(result.notes)}</div>` : ''}
          <div class="row">
            <button class="btn primary sm" data-to-compose>${svg('send', 14)} Ouvrir dans le compositeur</button>
            <button class="btn sm" data-copy-draft>${svg('copy', 14)} Copier le texte</button>
          </div>
        </div>
      </div>`;
  }
})();
