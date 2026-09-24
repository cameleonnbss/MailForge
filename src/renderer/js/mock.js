/* language: JavaScript, file: src/renderer/js/mock.js
   Browser-only fallback bridge. When the interface is opened outside Electron
   (plain http/file preview) this stands in for the preload API with in-memory
   data, so every view renders. It never loads inside the packaged app. */
(function () {
  const MF = (window.MF = window.MF || {});
  if (window.mailforge) return;

  const now = Date.now();
  const state = {
    version: 1,
    ui: { theme: 'dark', accent: 'indigo', animations: true, compact: false, language: 'fr', lastView: 'dashboard' },
    smtp: {
      profiles: [
        { id: 'demo', label: 'Demo SMTP', transport: 'smtp', host: 'smtp.example.com', port: 587, secure: false, user: 'demo@example.com', from: 'demo@example.com', fromName: 'Demo', passwordSet: true, active: true }
      ],
      activeProfileId: 'demo'
    },
    send: { throttleMs: 4000, jitterMs: 1500, dailyCap: 200, unsubscribeFooter: true, unsubscribeText: 'Repondez STOP pour ne plus recevoir nos messages.', defaultFromName: '' },
    tempmail: { activeProvider: 'mailtm', autoRefreshSec: 12, boxes: [] },
    ai: { activeProviderId: 'groq', language: 'fr', tone: 'professionnel', length: 'moyen', providers: [], customInstructions: '' },
    history: [
      { ts: new Date(now - 420000).toISOString(), kind: 'campaign', to: '182 destinataires', subject: 'Ouverture de la nouvelle plateforme', ok: true, sent: 182, failed: 0, skipped: 3, elapsedMs: 734000 },
      { ts: new Date(now - 5400000).toISOString(), kind: 'single', to: 'claire.martin@example.com', subject: 'Devis revise', ok: true, ms: 812, messageId: '<a1b2@example.com>' },
      { ts: new Date(now - 90000000).toISOString(), kind: 'single', to: 'contact@bad-domain.invalid', subject: 'Suivi', ok: false, error: 'ETIMEDOUT — pas de reponse du serveur MX' }
    ],
    logs: [
      { ts: new Date(now - 4000).toISOString(), level: 'info', message: 'Interface prete', scope: 'app' },
      { ts: new Date(now - 90000).toISOString(), level: 'success', message: 'Campagne terminee: 182 envoyes, 0 echecs', scope: 'smtp' },
      { ts: new Date(now - 120000).toISOString(), level: 'warn', message: 'Throttle sous 1 s ignore, 4000 ms applique', scope: 'smtp' }
    ],
    snippets: [
      { id: 's1', title: 'Signature', body: 'Bien a vous,\nCameleon Mortis\nhttps://github.com/cameleonnbss', tags: ['signature'], updatedAt: new Date(now - 86400000).toISOString() }
    ],
    templates: [
      { id: 't1', name: 'Premier contact', subject: 'Prise de contact', category: 'prospection', html: '<p>Bonjour {{nom}},</p><p>Je me permets de vous ecrire au sujet de...</p><p>Bien cordialement,</p>', updatedAt: new Date(now - 172800000).toISOString() }
    ],
    suppression: ['optout@example.com'],
    stats: { sentTotal: 1284, failedTotal: 37, bytesSent: 84212221, tempMailboxes: 12 }
  };

  const CATALOG = [
    { id: 'fake-data', label: 'Donnees fictives', icon: 'user', group: 'Generateurs', description: 'Identites, adresses, IBAN, societes.' },
    { id: 'password', label: 'Mots de passe', icon: 'key', group: 'Generateurs', description: 'Crypto-aleatoire avec entropie.' },
    { id: 'uuid', label: 'UUID / ULID', icon: 'hash', group: 'Generateurs', description: 'v4, compact, ULID.' },
    { id: 'lorem', label: 'Texte de test', icon: 'paragraph', group: 'Generateurs', description: 'Lorem ipsum texte ou HTML.' },
    { id: 'base64', label: 'Base64', icon: 'code', group: 'Encodeurs', description: 'Encode / decode.' },
    { id: 'urlencode', label: 'URL encode', icon: 'link', group: 'Encodeurs', description: 'encodeURIComponent.' },
    { id: 'hash', label: 'Hachage', icon: 'fingerprint', group: 'Encodeurs', description: 'SHA-256, SHA-1, MD5.' },
    { id: 'case', label: 'Casse & slug', icon: 'type', group: 'Encodeurs', description: 'Casse, slug, camelCase.' },
    { id: 'json', label: 'JSON', icon: 'brackets', group: 'Data', description: 'Formatage et validation.' },
    { id: 'timestamp', label: 'Horodatage', icon: 'clock', group: 'Data', description: 'Unix <-> ISO.' },
    { id: 'color', label: 'Couleurs', icon: 'palette', group: 'Data', description: 'HEX / RGB / HSL.' },
    { id: 'diff', label: 'Comparateur', icon: 'diff', group: 'Data', description: 'Diff ligne par ligne.' },
    { id: 'headers', label: 'Analyseur de headers', icon: 'mail', group: 'E-mail', description: 'SPF, DKIM, DMARC, delais.' },
    { id: 'templates', label: 'Modeles e-mail', icon: 'template', group: 'E-mail', description: 'Modeles reutilisables.' },
    { id: 'snippets', label: 'Snippets', icon: 'clipboard', group: 'E-mail', description: 'Blocs de texte.' },
    { id: 'stats', label: 'Statistiques texte', icon: 'chart', group: 'Data', description: 'Mots, octets, lecture.' }
  ];

  const listeners = [];
  const emit = (type, payload) => listeners.forEach((handler) => handler({ type, payload, ts: Date.now() }));

  function unwrap(value) {
    return Promise.resolve(value);
  }

  window.mailforge = {
    __mock: true,
    app: {
      info: () =>
        unwrap({
          name: 'MailForge',
          version: '1.0.0 (apercu navigateur)',
          electron: null,
          chrome: navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] || '—',
          node: null,
          platform: 'browser',
          arch: '—',
          packaged: false,
          dataDir: '(apercu navigateur — donnees en memoire)',
          exportsDir: ''
        }),
      openExternal: (url) => {
        window.open(url, '_blank', 'noopener');
        return unwrap(true);
      },
      openPath: () => unwrap(true),
      pickFiles: () => unwrap([]),
      saveFile: () => unwrap({ saved: false }),
      readFile: () => unwrap({ content: '' }),
      stats: () => unwrap(state.stats)
    },
    window: {
      minimize: () => unwrap(true),
      toggleMaximize: () => unwrap(true),
      close: () => unwrap(true),
      state: () => unwrap({ maximized: false, focused: true, fullscreen: false })
    },
    store: {
      all: () => unwrap(JSON.parse(JSON.stringify(state))),
      get: (key, fallback) => unwrap(key.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), state) ?? fallback),
      set: (key, value) => {
        const parts = key.split('.');
        let cursor = state;
        for (let i = 0; i < parts.length - 1; i += 1) cursor = cursor[parts[i]] = cursor[parts[i]] || {};
        cursor[parts[parts.length - 1]] = value;
        return unwrap(value);
      },
      merge: (patch) => {
        Object.assign(state, patch);
        return unwrap(JSON.parse(JSON.stringify(state)));
      },
      reset: () => unwrap(JSON.parse(JSON.stringify(state))),
      exportAll: () => unwrap({ generatedAt: new Date().toISOString(), state }),
      importAll: () => unwrap(JSON.parse(JSON.stringify(state)))
    },
    logs: { write: () => unwrap({}), list: () => unwrap(state.logs.slice().reverse()), clear: () => unwrap(true) },
    smtp: {
      profiles: () => unwrap({ profiles: state.smtp.profiles, activeProfileId: 'demo', protocols: [{ id: 'resend', label: 'Resend', endpoint: 'https://api.resend.com/emails' }] }),
      saveProfile: (profile) => {
        state.smtp.profiles = [...state.smtp.profiles.filter((item) => item.id !== profile.id), { ...profile, id: profile.id || 'demo2', passwordSet: true }];
        return unwrap({ id: profile.id || 'demo2', profiles: state.smtp.profiles, activeProfileId: 'demo' });
      },
      deleteProfile: (id) => unwrap({ profiles: state.smtp.profiles.filter((item) => item.id !== id), activeProfileId: 'demo' }),
      setActive: (id) => unwrap({ id }),
      verify: () => unwrap({ ok: true, ms: 412, message: 'Serveur pret a accepter des messages.', hint: 'Apercu navigateur: reponse simulee.' }),
      send: (payload) =>
        unwrap({ ok: true, id: `<${Math.random().toString(36).slice(2)}@example.com>`, response: '250 OK (simule)', ms: 640, to: payload?.message?.to }),
      bulkStart: async (payload) => {
        const total = payload?.recipients?.length || 0;
        emit('bulk:start', { total, skipped: 0, delayMs: payload?.throttleMs || 4000 });
        for (let i = 1; i <= total; i += 1) {
          await new Promise((resolve) => setTimeout(resolve, 320));
          emit('bulk:progress', { index: i, total, email: payload.recipients[i - 1].email, ok: true, ms: 520 });
        }
        const summary = { total, sent: total, failed: 0, skipped: 0, aborted: false, elapsedMs: total * 520, results: [] };
        emit('bulk:done', summary);
        return summary;
      },
      bulkCancel: () => unwrap(true),
      parseList: () => unwrap({ recipients: [], invalid: 0, duplicates: 0, suppressed: 0 })
    },
    suppression: { list: () => unwrap(state.suppression), add: (entries) => unwrap([...state.suppression, ...String(entries).split(/\s+/)].filter(Boolean)), remove: () => unwrap(state.suppression) },
    history: { list: () => unwrap(state.history), clear: () => unwrap(true), export: () => unwrap('ts,to,subject,ok\n') },
    tempmail: {
      providers: () => unwrap({ providers: [{ id: 'mailtm', label: 'mail.tm', description: 'API officielle', stable: true }, { id: 'maildrop', label: 'Maildrop', description: 'Sans inscription', stable: false }], activeProvider: 'mailtm' }),
      create: (providerId) => {
        const box = { id: `box${Date.now()}`, provider: providerId || 'mailtm', label: 'mail.tm', address: `mf${Math.random().toString(36).slice(2, 9)}@example.test`, createdAt: new Date().toISOString(), unread: 0, received: 0 };
        state.tempmail.boxes = [box, ...(state.tempmail.boxes || [])];
        return unwrap(box);
      },
      boxes: () => unwrap(state.tempmail.boxes || []),
      poll: () => unwrap([]),
      read: () => unwrap({ text: 'Apercu navigateur — aucun contenu reel.', html: '' }),
      destroy: (boxId) => {
        state.tempmail.boxes = (state.tempmail.boxes || []).filter((box) => box.id !== boxId);
        return unwrap(true);
      },
      forgetAll: () => unwrap(true),
      setProvider: (id) => unwrap(id)
    },
    ai: {
      catalog: () =>
        unwrap({
          providers: [
            { id: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', keyUrl: 'https://console.groq.com/keys', free: true, note: 'Palier gratuit rapide.', configured: false },
            { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct:free', keyUrl: 'https://openrouter.ai/keys', free: true, note: 'Modeles :free.', configured: false },
            { id: 'gemini', label: 'Google AI Studio', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash', keyUrl: 'https://aistudio.google.com/app/apikey', free: true, note: 'Palier gratuit.', configured: false }
          ],
          activeProviderId: 'groq',
          language: 'fr',
          tone: 'professionnel',
          length: 'moyen',
          customInstructions: ''
        }),
      saveProvider: () => unwrap({}),
      setActive: (id) => unwrap(id),
      draft: () =>
        unwrap({
          ok: true,
          subject: 'Brouillon simule — apercu navigateur',
          html: '<p>Bonjour,</p><p>Ce texte provient du mode apercu. Dans l\'application, il est genere par le fournisseur IA que vous avez configure.</p><p>Bien cordialement,</p>',
          text: 'Bonjour,\n\nCe texte provient du mode apercu.',
          notes: 'Apercu navigateur: aucune requete reelle.',
          provider: 'apercu',
          model: 'aucun',
          usage: null
        }),
      test: () => unwrap({ ok: true, ms: 90, message: 'Apercu navigateur: aucun appel reseau.' })
    },
    tools: {
      catalog: () => unwrap(CATALOG),
      run: (id, params) => unwrap(mockTool(id, params))
    },
    snippets: {
      list: () => unwrap(state.snippets),
      save: (snippet) => {
        state.snippets = [{ ...snippet, id: snippet.id || `s${Date.now()}` }, ...state.snippets.filter((item) => item.id !== snippet.id)];
        return unwrap(state.snippets);
      },
      remove: (id) => {
        state.snippets = state.snippets.filter((item) => item.id !== id);
        return unwrap(state.snippets);
      }
    },
    templates: {
      list: () => unwrap(state.templates),
      save: (template) => {
        state.templates = [{ ...template, id: template.id || `t${Date.now()}` }, ...state.templates.filter((item) => item.id !== template.id)];
        return unwrap(state.templates);
      },
      remove: (id) => {
        state.templates = state.templates.filter((item) => item.id !== id);
        return unwrap(state.templates);
      }
    },
    onEvent: (handler) => {
      listeners.push(handler);
      return () => {
        const index = listeners.indexOf(handler);
        if (index >= 0) listeners.splice(index, 1);
      };
    }
  };

  function mockTool(id, params = {}) {
    const text = params.text || '';
    switch (id) {
      case 'json':
        try {
          return { ok: true, output: JSON.stringify(JSON.parse(text), null, 2), stats: { bytes: text.length, keys: 0, depth: 1, lines: 1 } };
        } catch (error) {
          return { ok: false, error: `apercu: ${error.message}` };
        }
      case 'base64':
        try {
          return { output: params.mode === 'decode' ? atob(text) : btoa(unescape(encodeURIComponent(text))) };
        } catch {
          return { output: '' };
        }
      case 'password':
        return { password: 'Apercu-9fK2mQ7xLd', entropyBits: 104, strength: { label: 'solide', score: 3, bits: 104 } };
      case 'uuid':
        return { values: [crypto.randomUUID()] };
      case 'hash':
        return { hashes: { note: 'apercu navigateur — utilisez l\'application pour le hachage reel' } };
      case 'lorem':
        return { text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', html: '<p>Lorem ipsum dolor sit amet.</p>', stats: { characters: 55, words: 8, lines: 1, bytes: 55, readMinutes: 1 } };
      case 'fake-data':
        return { rows: [{ fullName: 'Apercu Navigateur', email: 'apercu@example.test', city: 'Lyon' }], csv: '', json: '[]' };
      case 'headers':
        return { ok: true, counts: { headers: 0, received: 0, parts: 0, bodyBytes: 0 }, headers: [], received: [], flags: [], auth: {}, duplicated: [], parts: [] };
      case 'stats':
        return { characters: text.length, words: text.trim() ? text.trim().split(/\s+/).length : 0, lines: text ? text.split('\n').length : 0, bytes: text.length, readMinutes: 1, charactersNoSpaces: text.replace(/\s/g, '').length };
      default:
        return { output: '', note: `Outil ${id} disponible dans l'application desktop.` };
    }
  }

  console.info('[MailForge] Apercu navigateur: preload Electron absent, pont simule installe.');
})();
