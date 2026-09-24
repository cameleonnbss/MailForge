/* language: JavaScript, file: src/renderer/js/views/settings.js
   Settings: appearance, send profiles (SMTP + API), temp-mail defaults, AI
   defaults, data import/export, suppression list and about/links. */
(function () {
  const MF = (window.MF = window.MF || {});
  const { svg } = MF.icons;
  const { esc, notify, copy, saveText, number } = MF.ui;

  const TABS = [
    { id: 'appearance', label: 'Apparence', icon: 'palette' },
    { id: 'send', label: 'Envoi', icon: 'database' },
    { id: 'tempmail', label: 'Boites temp.', icon: 'inbox' },
    { id: 'ai', label: 'Redaction IA', icon: 'sparkles' },
    { id: 'data', label: 'Donnees', icon: 'save' },
    { id: 'about', label: 'A propos', icon: 'info' }
  ];

  const REPO = 'https://github.com/cameleonnbss/MailForge';
  const AUTHOR = 'https://github.com/cameleonnbss';
  const DISCORD = 'cameleonmortis';

  let tab = 'appearance';
  let info = null;
  let profiles = { profiles: [], activeProfileId: null, protocols: [] };
  let suppression = [];
  let editingProfile = null;
  let providerPayload = { providers: [], activeProvider: 'mailtm' };
  let aiPayload = { providers: [], activeProviderId: 'groq' };

  function field(label, input, hint = '') {
    return `<label class="field"><span class="label">${esc(label)}</span>${input}${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
  }

  /* --------------------------------------------------------- appearance -- */

  function appearanceTab() {
    const ui = MF.state.get('ui', {});
    return `
      <div class="card">
        <header><span class="title">${svg('palette', 15)} Accent</span></header>
        <div class="swatches">
          ${MF.state.ACCENTS.map(
            (accent) => `<button class="swatch ${ui.accent === accent.id ? 'active' : ''}" data-accent="${accent.id}" style="background:${accent.color}" title="${esc(accent.label)}"></button>`
          ).join('')}
        </div>
        <div class="hint" style="margin-top:var(--s-3)">L'accent colore les bordures actives, les graphiques et les boutons principaux. Six paliers, aucun rechargement.</div>
      </div>

      <div class="card">
        <header><span class="title">${svg('eye', 15)} Confort</span></header>
        <div class="setting-row">
          <div class="info"><span class="n">Animations</span><span class="d">Transitions de vues, pulsations du journal, apparition des notifications.</span></div>
          <div class="control"><label class="check"><input type="checkbox" data-ui="animations" ${ui.animations !== false ? 'checked' : ''}> Actives</label></div>
        </div>
        <div class="setting-row">
          <div class="info"><span class="n">Densite compacte</span><span class="d">Reduit les espacements pour afficher davantage de lignes dans les tableaux.</span></div>
          <div class="control"><label class="check"><input type="checkbox" data-ui="compact" ${ui.compact ? 'checked' : ''}> Activer</label></div>
        </div>
        <div class="setting-row">
          <div class="info"><span class="n">Langue de l'interface</span><span class="d">L'interface est en francais ; ce reglage preconfigure la langue des brouillons IA.</span></div>
          <div class="control">
            <select data-ui="language" style="width:130px">
              ${['fr', 'en', 'es', 'de', 'it'].map((lang) => `<option value="${lang}" ${ui.language === lang ? 'selected' : ''}>${lang.toUpperCase()}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="card">
        <header><span class="title">${svg('bolt', 15)} Raccourcis clavier</span></header>
        <div class="row" style="gap:var(--s-5);flex-wrap:wrap">
          ${[
            ['Ctrl K', 'Palette de commandes'],
            ['Ctrl 1..9', 'Navigation par vue'],
            ['Ctrl Entree', 'Envoyer / executer'],
            ['Ctrl N', 'Nouveau message'],
            ['Ctrl R', 'Recharger la vue'],
            ['Echap', 'Fermer la fenetre active']
          ]
            .map(([keys, label]) => `<div style="display:flex;flex-direction:column;gap:4px"><span class="kbd">${esc(keys)}</span><span class="hint">${esc(label)}</span></div>`)
            .join('')}
        </div>
      </div>`;
  }

  /* --------------------------------------------------------------- send -- */

  function profileCard(profile) {
    const active = profile.id === profiles.activeProfileId;
    const target = profile.transport === 'api' ? `${profile.protocol} · ${profile.endpoint || profile.domain || '(endpoint)'}` : `${profile.host}:${profile.port}${profile.secure ? ' SSL' : ' STARTTLS'}`;
    return `
      <div class="profile-card ${active ? 'active' : ''}">
        <button class="btn ghost icon" data-activate-profile="${esc(profile.id)}" title="${active ? 'Profil actif' : 'Rendre actif'}">${svg(active ? 'check' : 'database', 15)}</button>
        <div class="meta">
          <div class="n">${esc(profile.label)} ${active ? '<span class="pill accent" style="margin-left:6px">actif</span>' : ''} ${profile.transport === 'api' ? '<span class="pill info" style="margin-left:6px">API</span>' : ''}</div>
          <div class="d">${esc(target)} ${profile.user ? `· ${esc(profile.user)}` : ''} ${profile.passwordSet || profile.apiKeySet ? '· secret enregistre' : '· aucun secret'}</div>
        </div>
        <div class="row" style="flex:none">
          <button class="btn ghost sm" data-test-profile="${esc(profile.id)}">${svg('bolt', 13)} Tester</button>
          <button class="btn ghost sm" data-edit-profile="${esc(profile.id)}">${svg('save', 13)} Modifier</button>
          <button class="btn ghost sm" data-delete-profile="${esc(profile.id)}">${svg('trash', 13)}</button>
        </div>
      </div>`;
  }

  function sendTab() {
    const send = MF.state.get('send', {});
    return `
      <div class="card">
        <header>
          <span class="title">${svg('database', 15)} Profils d'envoi</span>
          <div class="row">
            <span class="pill">${profiles.profiles.length}</span>
            <button class="btn primary sm" data-new-profile>${svg('plus', 14)} Ajouter un profil</button>
          </div>
        </header>
        <div class="stack tight">
          ${profiles.profiles.length ? profiles.profiles.map(profileCard).join('') : `<div class="hint">Aucun profil. Un profil decrit comment les messages partent : serveur SMTP ou cle d'API HTTP.</div>`}
        </div>
        <div class="banner" style="margin-top:var(--s-3)">
          ${svg('info', 16)}
          <div>Pour Gmail, Outlook ou Yahoo, utilisez un <strong>mot de passe d'application</strong> et le port 587 en STARTTLS (ou 465 en SSL direct). Les transports API (Resend, SendGrid, Brevo, Mailgun) acceptent une cle a la place d'un mot de passe.</div>
        </div>
      </div>

      <div class="card">
        <header><span class="title">${svg('clock', 15)} Rythme par defaut</span></header>
        <div class="setting-row">
          <div class="info"><span class="n">Delai entre deux messages</span><span class="d">Valeur par defaut des campagnes. Le minimum applique est de 1000 ms.</span></div>
          <div class="control"><input type="number" data-send="throttleMs" value="${Number(send.throttleMs) || 4000}" min="1000" max="60000" step="500" style="width:130px"></div>
        </div>
        <div class="setting-row">
          <div class="info"><span class="n">Gigue aleatoire</span><span class="d">Ajoute un ecart irregulier pour eviter un rythme parfaitement mecanique.</span></div>
          <div class="control"><input type="number" data-send="jitterMs" value="${Number(send.jitterMs) || 1500}" min="0" max="20000" step="250" style="width:130px"></div>
        </div>
        <div class="setting-row">
          <div class="info"><span class="n">Nom d'expediteur par defaut</span><span class="d">Utilise quand le compositeur n'en fournit pas.</span></div>
          <div class="control"><input type="text" data-send="defaultFromName" value="${esc(send.defaultFromName || '')}" style="width:220px"></div>
        </div>
      </div>

      <div class="card">
        <header><span class="title">${svg('shield', 15)} Conformite des envois groupes</span></header>
        <div class="setting-row">
          <div class="info"><span class="n">Ligne de desinscription</span><span class="d">Ajoutee en pied de chaque message de campagne.</span></div>
          <div class="control"><label class="check"><input type="checkbox" data-send="unsubscribeFooter" ${send.unsubscribeFooter !== false ? 'checked' : ''}> Activer</label></div>
        </div>
        ${field('Texte de desinscription', `<input type="text" data-send="unsubscribeText" value="${esc(send.unsubscribeText || '')}">`)}
      </div>

      <div class="card">
        <header><span class="title">${svg('filter', 15)} Liste d'exclusion</span><span class="pill">${suppression.length}</span></header>
        ${field('Ajouter des adresses', `<textarea data-suppression-add rows="3" placeholder="une adresse par ligne, ou separees par des virgules"></textarea>`)}
        <div class="row" style="margin-top:var(--s-3)"><button class="btn primary sm" data-suppression-save>${svg('plus', 14)} Ajouter</button></div>
        ${suppression.length
          ? `<div class="row" style="margin-top:var(--s-4);max-height:170px;overflow:auto">${suppression
              .map((email) => `<span class="chip">${esc(email)}<button data-suppression-remove="${esc(email)}">&times;</button></span>`)
              .join('')}</div>`
          : '<div class="hint" style="margin-top:var(--s-3)">Aucune adresse exclue. Les campagnes ignorent automatiquement toute adresse presente ici.</div>'}
      </div>`;
  }

  /* ----------------------------------------------------------- tempmail -- */

  function tempmailTab() {
    const config = MF.state.get('tempmail', {});
    return `
      <div class="card">
        <header><span class="title">${svg('inbox', 15)} Fournisseurs</span><span class="hint">Un fichier par backend cote application.</span></header>
        <div class="stack tight">
          ${providerPayload.providers
            .map(
              (provider) => `
            <div class="profile-card ${provider.id === providerPayload.activeProvider ? 'active' : ''}">
              <button class="btn ghost icon" data-use-provider="${esc(provider.id)}">${svg(provider.id === providerPayload.activeProvider ? 'check' : 'inbox', 15)}</button>
              <div class="meta">
                <div class="n">${esc(provider.label)} ${provider.stable ? '<span class="pill ok" style="margin-left:6px">API officielle</span>' : '<span class="pill warn" style="margin-left:6px">fiabilite variable</span>'}</div>
                <div class="d">${esc(provider.description)}</div>
              </div>
              ${provider.docs ? `<button class="btn ghost sm" data-open="${esc(provider.docs)}">${svg('external', 13)} Documentation</button>` : ''}
            </div>`
            )
            .join('')}
        </div>
      </div>

      <div class="card">
        <header><span class="title">${svg('refresh', 15)} Rafraichissement</span></header>
        <div class="setting-row">
          <div class="info"><span class="n">Intervalle automatique</span><span class="d">Frequence du releve quand la vue Boite temporaire est ouverte. Minimum 5 secondes.</span></div>
          <div class="control"><input type="number" data-tempmail="autoRefreshSec" value="${Number(config.autoRefreshSec) || 12}" min="5" max="120" style="width:110px"> <span class="hint">secondes</span></div>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------ ai -- */

  function aiTab() {
    return `
      <div class="card">
        <header><span class="title">${svg('sparkles', 15)} Fournisseur actif</span></header>
        <div class="stack tight">
          ${aiPayload.providers
            .map(
              (provider) => `
            <div class="profile-card ${provider.id === aiPayload.activeProviderId ? 'active' : ''}">
              <button class="btn ghost icon" data-use-ai="${esc(provider.id)}">${svg(provider.id === aiPayload.activeProviderId ? 'check' : 'sparkles', 15)}</button>
              <div class="meta">
                <div class="n">
                  ${esc(provider.label)}
                  ${provider.free ? '<span class="pill ok" style="margin-left:6px">gratuit</span>' : ''}
                  ${provider.local ? '<span class="pill info" style="margin-left:6px">local</span>' : ''}
                  ${provider.configured ? '<span class="pill accent" style="margin-left:6px">cle enregistree</span>' : ''}
                </div>
                <div class="d">${esc(provider.model || 'modele a definir')} · ${esc(provider.baseUrl || '—')}</div>
              </div>
              <div class="row" style="flex:none">
                ${provider.keyUrl ? `<button class="btn ghost sm" data-open="${esc(provider.keyUrl)}">${svg('external', 13)} Cle</button>` : ''}
                <button class="btn ghost sm" data-ai-configure="${esc(provider.id)}">${svg('save', 13)} Configurer</button>
              </div>
            </div>`
            )
            .join('')}
        </div>
        <div class="banner" style="margin-top:var(--s-3)">${svg('info', 16)}<div>La redaction complete se fait dans la vue <strong>Redaction IA</strong>. Les reglages ci-dessous servent de valeurs par defaut partout ailleurs.</div></div>
      </div>

      <div class="card">
        <header><span class="title">${svg('wand', 15)} Valeurs par defaut</span></header>
        <div class="row" style="gap:var(--s-4)">
          ${field('Langue', `<select data-ai="language" style="width:110px">${['fr', 'en', 'es', 'de', 'it'].map((l) => `<option value="${l}" ${MF.state.get('ai.language') === l ? 'selected' : ''}>${l.toUpperCase()}</option>`).join('')}</select>`)}
          ${field('Ton', `<select data-ai="tone" style="width:150px">${['professionnel', 'cordial', 'direct', 'commercial', 'technique', 'ferme'].map((t) => `<option value="${t}" ${MF.state.get('ai.tone') === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`)}
          ${field('Longueur', `<select data-ai="length" style="width:130px">${['court', 'moyen', 'long', 'treslong'].map((l) => `<option value="${l}" ${MF.state.get('ai.length') === l ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`)}
        </div>
        <div style="margin-top:var(--s-3)">
          ${field('Consignes permanentes ajoutees a chaque generation', `<input type="text" data-ai="customInstructions" value="${esc(MF.state.get('ai.customInstructions', ''))}" placeholder="ex : signer par l'equipe support, jamais de promesse de delai">`)}
        </div>
      </div>`;
  }

  /* --------------------------------------------------------------- data -- */

  function dataTab() {
    const stats = MF.state.get('stats', {});
    const counts = {
      profiles: profiles.profiles.length,
      history: MF.state.get('history', []).length,
      snippets: MF.state.get('snippets', []).length,
      templates: MF.state.get('templates', []).length,
      suppression: suppression.length,
      logs: MF.state.get('logs', []).length
    };
    return `
      <div class="card">
        <header><span class="title">${svg('database', 15)} Stockage</span></header>
        <div class="kv"><span class="k">Dossier de donnees</span><span class="v">${esc(info?.dataDir || '—')}</span></div>
        <div class="kv"><span class="k">Fichier de configuration</span><span class="v">${esc((info?.dataDir || '') + '\\mailforge.json')}</span></div>
        <div class="kv"><span class="k">Profil(s) d'envoi</span><span class="v">${counts.profiles}</span></div>
        <div class="kv"><span class="k">Entrees d'historique</span><span class="v">${counts.history}</span></div>
        <div class="kv"><span class="k">Modeles / snippets</span><span class="v">${counts.templates} / ${counts.snippets}</span></div>
        <div class="kv"><span class="k">Adresses exclues</span><span class="v">${counts.suppression}</span></div>
        <div class="kv"><span class="k">Lignes de journal</span><span class="v">${counts.logs}</span></div>
        <div class="kv"><span class="k">Messages envoyes (cumul)</span><span class="v">${number(stats.sentTotal)}</span></div>
        <div class="row" style="margin-top:var(--s-4)">
          <button class="btn" data-open-dir>${svg('external', 15)} Ouvrir le dossier</button>
          <button class="btn" data-export-all>${svg('download', 15)} Exporter toute la configuration</button>
          <button class="btn" data-import-all>${svg('upload', 15)} Importer</button>
          <button class="btn danger" data-reset>${svg('trash', 15)} Reinitialiser</button>
        </div>
        <div class="hint" style="margin-top:var(--s-3)">L'export ne contient aucun secret en clair : les mots de passe et cles sont remplaces par un marqueur.</div>
      </div>`;
  }

  /* -------------------------------------------------------------- about -- */

  function aboutTab() {
    return `
      <div class="card accent">
        <header><span class="title">${svg('mail', 15)} MailForge</span><span class="pill accent">v${esc(info?.version || '1.0.0')}</span></header>
        <p class="hint" style="color:var(--text-2)">
          Poste de travail e-mail de bureau : compositeur SMTP/API, envoi groupe a liste consentie, boites temporaires
          et seize utilitaires. Interface HTML/CSS/JS servie dans une fenetre applicative, sans navigateur externe.
        </p>
        <div class="about-grid" style="margin-top:var(--s-4)">
          <a class="card flat hoverable" href="#" data-open="${REPO}" style="text-decoration:none">
            <div class="row" style="gap:10px">${svg('code', 18)}<div><div style="font-weight:570;color:var(--text-1)">Depot GitHub</div><div class="hint">${esc(REPO.replace('https://', ''))}</div></div></div>
          </a>
          <a class="card flat hoverable" href="#" data-open="${AUTHOR}" style="text-decoration:none">
            <div class="row" style="gap:10px">${svg('user', 18)}<div><div style="font-weight:570;color:var(--text-1)">Profil de l'auteur</div><div class="hint">github.com/cameleonnbss</div></div></div>
          </a>
          <div class="card flat hoverable" data-copy-discord style="cursor:pointer">
            <div class="row" style="gap:10px">${svg('at', 18)}<div><div style="font-weight:570;color:var(--text-1)">Discord</div><div class="hint mono">${esc(DISCORD)}</div></div></div>
          </div>
          <a class="card flat hoverable" href="#" data-open="${REPO}/releases" style="text-decoration:none">
            <div class="row" style="gap:10px">${svg('download', 18)}<div><div style="font-weight:570;color:var(--text-1)">Versions</div><div class="hint">Executable et version portable</div></div></div>
          </a>
        </div>
      </div>

      <div class="card">
        <header><span class="title">${svg('info', 15)} Environnement</span></header>
        <div class="kv"><span class="k">Version</span><span class="v">${esc(info?.version || '—')}</span></div>
        <div class="kv"><span class="k">Electron</span><span class="v">${esc(info?.electron || '—')}</span></div>
        <div class="kv"><span class="k">Chromium</span><span class="v">${esc(info?.chrome || '—')}</span></div>
        <div class="kv"><span class="k">Node</span><span class="v">${esc(info?.node || '—')}</span></div>
        <div class="kv"><span class="k">Plateforme</span><span class="v">${esc(`${info?.platform || ''} ${info?.arch || ''}`)}</span></div>
        <div class="kv"><span class="k">Installe le</span><span class="v">${esc(MF.ui.date(MF.state.get('installedAt')))}</span></div>
        <div class="kv"><span class="k">Licence</span><span class="v">MIT</span></div>
      </div>

      <div class="card">
        <header><span class="title">${svg('shield', 15)} Usage et responsabilite</span></header>
        <div class="banner warn">
          ${svg('alert', 16)}
          <div>
            <strong>Usage legal, ethique et educatif.</strong> Cet outil n'embarque aucune technique de contournement de
            filtre antispam : pas de rotation d'IP, pas d'usurpation d'en-tetes, pas de generation de variantes textuelles
            destinee a tromper les filtres. Envoyer des messages non sollicites ou frauduleux est illicite
            (RGPD et directive ePrivacy en Europe, CAN-SPAM aux Etats-Unis, LCEN en France) et detruit la reputation de
            votre domaine. L'editeur fournit un logiciel d'envoi, sans controle sur les messages qui y transitent :
            l'utilisateur est seul responsable de leur contenu, de leur legalite et du consentement de ses destinataires.
            Le detail figure dans <span class="mono">LEGAL.md</span>.
          </div>
        </div>
        <p class="hint" style="margin-top:var(--s-3)">Les secrets (mots de passe SMTP, cles d'API) sont chiffres au repos en AES-256-GCM et ne quittent jamais votre machine. Aucune telemetrie, aucun appel vers un serveur de l'editeur.</p>
      </div>`;
  }

  /* ----------------------------------------------------------------- view -- */

  MF.router.register({
    id: 'settings',
    title: 'Parametres',
    group: 'Systeme',
    icon: 'settings',
    description: 'Configuration de l\'application.',

    async preload() {
      const [appInfo, profileList, suppressed, providers, aiCatalog] = await Promise.all([
        MF.api.app.info(),
        MF.api.smtp.profiles(),
        MF.api.suppression.list(),
        MF.api.tempmail.providers(),
        MF.api.ai.catalog()
      ]);
      info = appInfo;
      profiles = profileList;
      suppression = suppressed;
      providerPayload = providers;
      aiPayload = aiCatalog;
    },

    render({ params }) {
      if (params.tab && TABS.some((entry) => entry.id === params.tab)) tab = params.tab;
      const content = {
        appearance: appearanceTab,
        send: sendTab,
        tempmail: tempmailTab,
        ai: aiTab,
        data: dataTab,
        about: aboutTab
      }[tab];
      return `
        <div class="page-head">
          <div class="titles">
            <h1>Parametres</h1>
            <p class="sub">Tout est stocke localement, dans un unique fichier JSON du dossier de donnees de l'application.</p>
          </div>
          <div class="actions">
            <span class="pill">${esc(info?.packaged ? 'version installee' : 'mode developpement')}</span>
          </div>
        </div>
        <div class="tabs" style="margin-bottom:var(--s-5)">
          ${TABS.map((entry) => `<button class="tab ${tab === entry.id ? 'active' : ''}" data-tab="${entry.id}">${svg(entry.icon, 13)} ${esc(entry.label)}</button>`).join('')}
        </div>
        <div class="stack" data-tab-content>${content ? content() : ''}</div>`;
    },

    async mount({ host }) {
      MF.ui.onClick(host, '[data-tab]', (target) => {
        tab = target.dataset.tab;
        MF.router.go('settings', { tab });
      });
      MF.ui.onClick(host, '[data-open]', (target, event) => {
        event.preventDefault();
        MF.api.app.openExternal(target.dataset.open);
      });
      MF.ui.onClick(host, '[data-copy-discord]', () => copy(DISCORD, 'Pseudo Discord copie'));

      /* appearance */
      MF.ui.onClick(host, '[data-accent]', async (target) => {
        await MF.state.setAccent(target.dataset.accent);
        notify.ok('Accent applique', target.dataset.accent);
        MF.router.reload();
      });
      host.querySelectorAll('[data-ui]').forEach((fieldEl) => {
        fieldEl.addEventListener('change', async () => {
          const key = fieldEl.dataset.ui;
          const value = fieldEl.type === 'checkbox' ? fieldEl.checked : fieldEl.value;
          await MF.state.setUi({ [key]: value });
          notify.ok('Reglage enregistre');
          if (key === 'compact') MF.router.reload();
        });
      });

      /* send */
      host.querySelectorAll('[data-send]').forEach((fieldEl) => {
        fieldEl.addEventListener('change', async () => {
          const key = fieldEl.dataset.send;
          const raw = fieldEl.type === 'checkbox' ? fieldEl.checked : fieldEl.value;
          const value = fieldEl.type === 'number' ? Math.max(0, Number(raw) || 0) : raw;
          await MF.state.set(`send.${key}`, value);
          notify.ok('Reglage enregistre', `${key} = ${value}`);
        });
      });
      MF.ui.onClick(host, '[data-new-profile]', () => openProfileEditor(null, host));
      MF.ui.onClick(host, '[data-edit-profile]', (target) => openProfileEditor(profiles.profiles.find((item) => item.id === target.dataset.editProfile), host));
      MF.ui.onClick(host, '[data-activate-profile]', async (target) => {
        const result = await MF.api.smtp.setActive(target.dataset.activateProfile);
        profiles.activeProfileId = result?.id || target.dataset.activateProfile;
        notify.ok('Profil actif mis a jour');
        MF.router.reload();
      });
      MF.ui.onClick(host, '[data-test-profile]', async (target) => {
        MF.ui.busy(target, true);
        target.dataset.busyLabel = 'Test...';
        const result = await MF.api.smtp.verify({ profileId: target.dataset.testProfile }).catch(() => null);
        MF.ui.busy(target, false);
        if (!result) return;
        notify[result.ok ? 'ok' : 'error'](result.ok ? `Connexion validee en ${result.ms} ms` : 'Connexion refusee', `${result.message}${result.hint ? ` — ${result.hint}` : ''}`);
      });
      MF.ui.onClick(host, '[data-delete-profile]', async (target) => {
        const profile = profiles.profiles.find((item) => item.id === target.dataset.deleteProfile);
        const ok = await MF.ui.confirm({ title: 'Supprimer le profil', message: profile?.label, confirmLabel: 'Supprimer', kind: 'danger' });
        if (!ok) return;
        profiles = await MF.api.smtp.deleteProfile(target.dataset.deleteProfile);
        notify.ok('Profil supprime');
        MF.router.reload();
      });
      MF.ui.onClick(host, '[data-suppression-save]', async () => {
        const value = host.querySelector('[data-suppression-add]').value;
        suppression = await MF.api.suppression.add(value);
        notify.ok('Liste mise a jour', `${suppression.length} adresse(s) exclue(s)`);
        MF.router.reload();
      });
      MF.ui.onClick(host, '[data-suppression-remove]', async (target) => {
        suppression = await MF.api.suppression.remove(target.dataset.suppressionRemove);
        MF.router.reload();
      });

      /* temp mail */
      MF.ui.onClick(host, '[data-use-provider]', async (target) => {
        providerPayload.activeProvider = await MF.api.tempmail.setProvider(target.dataset.useProvider);
        notify.ok('Fournisseur actif', providerPayload.activeProvider);
        MF.router.reload();
      });
      host.querySelectorAll('[data-tempmail]').forEach((fieldEl) => {
        fieldEl.addEventListener('change', async () => {
          await MF.state.set(`tempmail.${fieldEl.dataset.tempmail}`, Number(fieldEl.value) || 12);
          notify.ok('Intervalle enregistre');
        });
      });

      /* ai */
      MF.ui.onClick(host, '[data-use-ai]', async (target) => {
        aiPayload.activeProviderId = await MF.api.ai.setActive(target.dataset.useAi);
        notify.ok('Fournisseur IA actif', aiPayload.activeProviderId);
        MF.router.reload();
      });
      MF.ui.onClick(host, '[data-ai-configure]', (target) => {
        MF.router.go('ai');
      });
      host.querySelectorAll('[data-ai]').forEach((fieldEl) => {
        fieldEl.addEventListener('change', async () => {
          await MF.state.set(`ai.${fieldEl.dataset.ai}`, fieldEl.value);
          notify.ok('Reglage IA enregistre');
        });
      });

      /* data */
      MF.ui.onClick(host, '[data-open-dir]', () => MF.api.app.openPath(info?.dataDir));
      MF.ui.onClick(host, '[data-export-all]', async () => {
        const payload = await MF.api.store.exportAll();
        await saveText(JSON.stringify(payload, null, 2), `mailforge-export-${Date.now()}.json`, [{ name: 'JSON', extensions: ['json'] }]);
      });
      MF.ui.onClick(host, '[data-import-all]', async () => {
        const files = await MF.api.app.pickFiles();
        const file = files.find((item) => /\.json$/i.test(item.filename));
        if (!file) {
          notify.warn('Choisissez un fichier .json');
          return;
        }
        const ok = await MF.ui.confirm({
          title: 'Importer la configuration',
          message: 'Les reglages actuels seront remplaces par le contenu du fichier. Vos identifiants enregistres restent inchanges.',
          confirmLabel: 'Importer'
        });
        if (!ok) return;
        await MF.api.store.importAll(decodeURIComponent(escape(atob(file.content))));
        await MF.state.refresh();
        notify.ok('Configuration importee');
        MF.router.reload();
      });
      MF.ui.onClick(host, '[data-reset]', async () => {
        const ok = await MF.ui.confirm({
          title: 'Reinitialiser les reglages',
          message: 'Historique, journaux, modeles, snippets et preferences seront effaces. Les profils d\'envoi enregistres sont conserves.',
          confirmLabel: 'Reinitialiser',
          kind: 'danger'
        });
        if (!ok) return;
        await MF.api.store.reset(true);
        await MF.state.refresh();
        notify.ok('Reglages reinitialises');
        MF.router.reload();
      });
    }
  });

  /* ------------------------------------------------------ profile editor -- */

  function openProfileEditor(profile, host) {
    editingProfile = profile;
    const isApi = profile?.transport === 'api';
    const protocols = profiles.protocols || [];
    MF.ui.modal({
      title: profile ? `Profil — ${profile.label}` : 'Nouveau profil d\'envoi',
      size: 'wide',
      body: `
        <div class="stack">
          <div class="row" style="gap:var(--s-4)">
            <label class="field" style="flex:1;min-width:180px"><span class="label">Nom du profil</span>
              <input type="text" data-f="label" data-autofocus value="${esc(profile?.label || '')}" placeholder="Gmail perso, Resend production..."></label>
            <label class="field" style="width:200px"><span class="label">Transport</span>
              <select data-f="transport">
                <option value="smtp" ${!isApi ? 'selected' : ''}>SMTP (serveur de messagerie)</option>
                <option value="api" ${isApi ? 'selected' : ''}>API HTTP (fournisseur)</option>
              </select></label>
          </div>

          <div data-smtp-fields style="${isApi ? 'display:none' : ''}">
            <div class="row" style="gap:var(--s-3);align-items:flex-end">
              <label class="field" style="flex:1;min-width:200px"><span class="label">Hote SMTP</span>
                <input type="text" data-f="host" value="${esc(profile?.host || '')}" placeholder="smtp.gmail.com"></label>
              <label class="field" style="width:110px"><span class="label">Port</span>
                <input type="number" data-f="port" value="${Number(profile?.port) || 587}" min="1" max="65535"></label>
              <label class="field" style="width:150px"><span class="label">Chiffrement</span>
                <select data-f="secure">
                  <option value="false" ${!profile?.secure ? 'selected' : ''}>STARTTLS (587)</option>
                  <option value="true" ${profile?.secure ? 'selected' : ''}>SSL direct (465)</option>
                </select></label>
            </div>
            <div class="row" style="gap:var(--s-3);align-items:flex-end;margin-top:var(--s-3)">
              <label class="field" style="flex:1;min-width:200px"><span class="label">Utilisateur</span>
                <input type="text" data-f="user" value="${esc(profile?.user || '')}" placeholder="vous@domaine.tld"></label>
              <label class="field" style="flex:1;min-width:200px"><span class="label">Mot de passe / mot de passe d'application</span>
                <input type="password" data-f="password" placeholder="${profile?.passwordSet ? 'conserve — laisser vide' : 'saisir le mot de passe'}"></label>
            </div>
          </div>

          <div data-api-fields style="${isApi ? '' : 'display:none'}">
            <div class="row" style="gap:var(--s-3);align-items:flex-end">
              <label class="field" style="width:220px"><span class="label">Fournisseur</span>
                <select data-f="protocol">
                  ${protocols.map((entry) => `<option value="${esc(entry.id)}" ${profile?.protocol === entry.id ? 'selected' : ''}>${esc(entry.label)}</option>`).join('')}
                </select></label>
              <label class="field" style="flex:1;min-width:220px"><span class="label">Cle d'API</span>
                <input type="password" data-f="apiKey" placeholder="${profile?.apiKeySet ? 'conserve — laisser vide' : 'cle du fournisseur'}"></label>
            </div>
            <div class="row" style="gap:var(--s-3);align-items:flex-end;margin-top:var(--s-3)">
              <label class="field" style="flex:1;min-width:220px"><span class="label">Endpoint (vide = celui du fournisseur)</span>
                <input type="text" data-f="endpoint" value="${esc(profile?.endpoint || '')}" placeholder="https://api.resend.com/emails"></label>
              <label class="field" style="width:200px"><span class="label">Domaine (Mailgun)</span>
                <input type="text" data-f="domain" value="${esc(profile?.domain || '')}" placeholder="mg.domaine.tld"></label>
            </div>
            <div class="hint" data-protocol-hint style="margin-top:var(--s-2)"></div>
          </div>

          <div class="row" style="gap:var(--s-3);align-items:flex-end">
            <label class="field" style="flex:1;min-width:200px"><span class="label">Adresse d'expedition</span>
              <input type="text" data-f="from" value="${esc(profile?.from || '')}" placeholder="contact@domaine.tld"></label>
            <label class="field" style="flex:1;min-width:180px"><span class="label">Nom affiche</span>
              <input type="text" data-f="fromName" value="${esc(profile?.fromName || '')}" placeholder="Nom de l'expediteur"></label>
          </div>

          <label class="field"><span class="label">Adresse de reponse (optionnel)</span>
            <input type="text" data-f="replyTo" value="${esc(profile?.replyTo || '')}" placeholder="reponses@domaine.tld"></label>

          <div class="banner">${svg('shield', 16)}<div>Le mot de passe et la cle d'API sont chiffres par le systeme avant d'etre ecrits sur le disque (AES-256-GCM). Ils ne sont jamais renvoyes a l'interface apres enregistrement.</div></div>
          <label class="check"><input type="checkbox" data-f="rejectUnauthorized" ${profile?.rejectUnauthorized === false ? '' : 'checked'}> Verifier le certificat TLS du serveur <span class="hint">(a laisser coche : desactiver affaiblit la connexion)</span></label>
        </div>`,
      actions: [
        {
          label: 'Tester',
          position: 'left',
          keepOpen: true,
          onClick: async ({ node, button }) => {
            const draft = readForm(node);
            if (draft.transport === 'smtp' && !draft.host) {
              notify.warn('Hote SMTP manquant');
              return false;
            }
            MF.ui.busy(button, true);
            button.dataset.busyLabel = 'Test...';
            const result = await MF.api.smtp.verify({ draft }).catch(() => null);
            MF.ui.busy(button, false);
            if (result) notify[result.ok ? 'ok' : 'error'](result.ok ? `Connexion validee en ${result.ms} ms` : 'Connexion refusee', `${result.message}${result.hint ? ` — ${result.hint}` : ''}`);
            return false;
          }
        },
        { label: 'Annuler' },
        {
          label: profile ? 'Enregistrer' : 'Creer le profil',
          kind: 'primary',
          onClick: async ({ node }) => {
            const draft = readForm(node);
            if (!draft.label) {
              notify.warn('Nom du profil obligatoire');
              return false;
            }
            if (draft.transport === 'smtp' && !draft.host) {
              notify.warn('Hote SMTP obligatoire');
              return false;
            }
            const result = await MF.api.smtp.saveProfile({ ...(profile || {}), ...draft, id: profile?.id });
            profiles = { ...profiles, profiles: result.profiles, activeProfileId: result.activeProfileId };
            notify.ok('Profil enregistre', draft.label);
            MF.router.reload();
          }
        }
      ],
      onMount: ({ node }) => {
        const protocolSelect = node.querySelector('[data-f="protocol"]');
        const hint = node.querySelector('[data-protocol-hint]');
        const updateHint = () => {
          const entry = protocols.find((item) => item.id === protocolSelect.value);
          if (hint) hint.innerHTML = entry ? `${esc(entry.label)} — endpoint par defaut : <span class="mono">${esc(entry.endpoint)}</span>${entry.docs ? ` · <a href="#" data-docs="${esc(entry.docs)}">documentation</a>` : ''}` : '';
        };
        protocolSelect?.addEventListener('change', updateHint);
        updateHint();

        const transportSelect = node.querySelector('[data-f="transport"]');
        transportSelect.addEventListener('change', () => {
          const api = transportSelect.value === 'api';
          node.querySelector('[data-smtp-fields]').style.display = api ? 'none' : '';
          node.querySelector('[data-api-fields]').style.display = api ? '' : 'none';
        });
        MF.ui.onClick(node, '[data-docs]', (target, event) => {
          event.preventDefault();
          MF.api.app.openExternal(target.dataset.docs);
        });
      }
    });
  }

  function readForm(node) {
    const draft = {};
    node.querySelectorAll('[data-f]').forEach((fieldEl) => {
      const key = fieldEl.dataset.f;
      if (key === 'secure') draft.secure = fieldEl.value === 'true';
      else if (key === 'rejectUnauthorized') draft[key] = fieldEl.checked;
      else draft[key] = fieldEl.value.trim();
    });
    if (draft.port) draft.port = Number(draft.port);
    return draft;
  }
})();
