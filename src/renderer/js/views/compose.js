/* language: JavaScript, file: src/renderer/js/views/compose.js
   Composer: single-message send through SMTP or an HTTP mail API. Rich-text
   editor, attachments, snippets/templates insertion, optional AI drafting. */
(function () {
  const MF = (window.MF = window.MF || {});
  const { svg } = MF.icons;
  const { esc, notify, modal, copy } = MF.ui;

  const DRAFT_KEY = 'mailforge.compose.draft';

  const local = {
    attachments: [],
    profiles: { profiles: [], activeProfileId: null },
    snippets: [],
    templates: [],
    busy: false
  };

  function readDraft() {
    try {
      return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveDraft(patch) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...readDraft(), ...patch, savedAt: Date.now() }));
    } catch {
      /* storage full or disabled: drafts are a convenience only */
    }
  }

  function insertAtCursor(editor, html) {
    editor.focus();
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      editor.insertAdjacentHTML('beforeend', html);
      return;
    }
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(range.createContextualFragment(html));
    range.collapse(false);
  }

  function htmlToText(html) {
    const node = document.createElement('div');
    node.innerHTML = html;
    node.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
    node.querySelectorAll('p, div, li, tr').forEach((block) => block.append('\n'));
    return node.textContent.replace(/\n{3,}/g, '\n\n').trim();
  }

  function editorToolbar() {
    const groups = [
      [
        ['bold', 'B', 'Gras', 'font-weight:700'],
        ['italic', 'I', 'Italique', 'font-style:italic'],
        ['underline', 'U', 'Souligne', 'text-decoration:underline']
      ],
      [
        ['insertUnorderedList', '&bull;', 'Liste a puces', ''],
        ['insertOrderedList', '1.', 'Liste numerotee', '']
      ],
      [
        ['h3', 'T', 'Titre', 'font-weight:700;font-size:15px'],
        ['formatBlock:blockquote', '&ldquo;', 'Citation', ''],
        ['removeFormat', 'Tx', 'Effacer le style', 'font-size:11px']
      ]
    ];
    return `
      <div class="editor-toolbar" data-toolbar>
        ${groups
          .map(
            (group) =>
              group
                .map(
                  ([command, label, tip, style]) =>
                    `<button type="button" data-cmd="${esc(command)}" class="tooltip" data-tip="${esc(tip)}" style="${style}">${label}</button>`
                )
                .join('<span class="sep"></span>')
          )
          .join('')}
        <button type="button" data-cmd="createLink" class="tooltip" data-tip="Lien">${svg('link', 13)}</button>
        <button type="button" data-cmd="insertHorizontalRule" class="tooltip" data-tip="Separateur">&mdash;</button>
        <span class="sep"></span>
        <button type="button" data-insert-snippet>${svg('clipboard', 13)} Snippet</button>
        <button type="button" data-load-template>${svg('template', 13)} Modele</button>
        <span class="spacer" style="flex:1"></span>
        <button type="button" data-toggle-source class="tooltip" data-tip="Source HTML">${svg('code', 13)} HTML</button>
      </div>`;
  }

  MF.router.register({
    id: 'compose',
    title: 'Compositeur',
    group: 'E-mail',
    icon: 'send',
    description: 'Rediger et envoyer un message.',

    async preload() {
      const [profiles, snippets, templates] = await Promise.all([
        MF.api.smtp.profiles(),
        MF.api.snippets.list(),
        MF.api.templates.list()
      ]);
      local.profiles = profiles;
      local.snippets = snippets;
      local.templates = templates;
    },

    render() {
      const draft = readDraft();
      const handoff = MF.state.handoff;
      if (handoff) MF.state.handoff = null;
      const body = handoff?.html || draft.html || '';
      const subject = handoff?.subject || draft.subject || '';
      const profiles = local.profiles.profiles;

      return `
        <div class="page-head">
          <div class="titles">
            <h1>Compositeur</h1>
            <p class="sub">Envoi unique via SMTP ou API HTTP. Le message part du profil actif, avec pieces jointes et version texte automatique.</p>
          </div>
          <div class="actions">
            <span class="pill ${local.profiles.activeProfileId ? 'accent' : 'warn'}">
              ${svg('database', 12)} ${esc(profiles.find((p) => p.id === local.profiles.activeProfileId)?.label || 'aucun profil')}
            </span>
            <button class="btn" data-test>${svg('bolt', 15)} Tester la connexion</button>
            <button class="btn ghost" data-go="settings" data-go-params='{"tab":"send"}'>${svg('settings', 15)} Profils</button>
          </div>
        </div>

        ${profiles.length ? '' : `<div class="banner warn" style="margin-bottom:var(--s-4)">${svg('alert', 16)}<div><strong>Aucun profil d'envoi.</strong> Ajoutez un serveur SMTP ou une cle d'API avant d'envoyer.</div><button class="btn sm" data-go="settings" data-go-params='{"tab":"send"}'>Configurer</button></div>`}

        <div class="compose-grid">
          <div class="stack">
            <div class="card">
              <div class="stack tight">
                <div class="row" style="gap:var(--s-3);align-items:flex-end">
                  <label class="field" style="flex:1;min-width:180px">
                    <span class="label">Expediteur</span>
                    <input type="text" data-from placeholder="vous@domaine.tld" value="${esc(draft.from || '')}">
                  </label>
                  <label class="field" style="flex:1;min-width:150px">
                    <span class="label">Nom affiche</span>
                    <input type="text" data-from-name placeholder="Prenom Nom" value="${esc(draft.fromName || '')}">
                  </label>
                </div>
                <label class="field">
                  <span class="label">Destinataire</span>
                  <input type="text" data-to placeholder="destinataire@domaine.tld (plusieurs adresses separent par une virgule)" value="${esc(draft.to || '')}">
                </label>
                <div class="row" style="gap:var(--s-3);align-items:flex-end">
                  <label class="field" style="flex:1;min-width:160px">
                    <span class="label">Copie (Cc)</span>
                    <input type="text" data-cc placeholder="optionnel" value="${esc(draft.cc || '')}">
                  </label>
                  <label class="field" style="flex:1;min-width:160px">
                    <span class="label">Copie cachee (Cci)</span>
                    <input type="text" data-bcc placeholder="optionnel" value="${esc(draft.bcc || '')}">
                  </label>
                </div>
                <label class="field">
                  <span class="label">Objet</span>
                  <input type="text" data-subject placeholder="Objet du message" value="${esc(subject)}">
                </label>
              </div>
            </div>

            <div class="card" style="padding:0;border:none;background:none;box-shadow:none">
              ${editorToolbar()}
              <div class="editor-body" contenteditable="true" data-editor data-placeholder="Ecrivez votre message...">${body}</div>
            </div>

            <div class="card">
              <header>
                <span class="title">${svg('file', 15)} Pieces jointes</span>
                <button class="btn sm" data-attach>${svg('plus', 14)} Ajouter</button>
              </header>
              <div class="attachments" data-attachments>
                ${local.attachments.length
                  ? local.attachments
                      .map(
                        (file, index) => `
                  <span class="chip">${svg('file', 12)} ${esc(file.filename)} <span class="hint">${MF.ui.bytes(file.size)}</span><button data-drop-attachment="${index}" title="Retirer">&times;</button></span>`
                      )
                      .join('')
                  : '<span class="hint">Aucune piece jointe. Limite de 20 Mo par fichier.</span>'}
              </div>
            </div>

            <div class="row between">
              <div class="row">
                <button class="btn primary lg" data-send ${profiles.length ? '' : 'disabled'}>${svg('send', 15)} Envoyer</button>
                <button class="btn" data-preview>${svg('eye', 15)} Apercu</button>
              </div>
              <div class="row">
                <button class="btn ghost" data-save-template>${svg('save', 15)} Enregistrer comme modele</button>
                <button class="btn ghost" data-to-campaign>${svg('users', 15)} Envoyer a une liste</button>
                <button class="btn ghost danger" data-reset>${svg('trash', 15)} Vider</button>
              </div>
            </div>

            <div data-result></div>
          </div>

          <aside class="stack">
            <div class="card accent">
              <header><span class="title">${svg('sparkles', 15)} Redaction assistee</span><span class="pill">optionnel</span></header>
              <label class="field">
                <span class="label">Que doit dire ce message ?</span>
                <textarea data-ai-brief rows="3" placeholder="Relance d'un devis envoye la semaine derniere, ton courtois, proposition d'appel de 15 minutes"></textarea>
              </label>
              <div class="stack tight">
                <div class="row" style="gap:var(--s-2)">
                  <label class="field" style="flex:1;min-width:90px">
                    <span class="label">Langue</span>
                    <select data-ai-lang>
                      ${['fr', 'en', 'es', 'de', 'it', 'pt', 'nl'].map((lang) => `<option value="${lang}" ${MF.state.get('ai.language', 'fr') === lang ? 'selected' : ''}>${lang.toUpperCase()}</option>`).join('')}
                    </select>
                  </label>
                  <label class="field" style="flex:2;min-width:130px">
                    <span class="label">Longueur</span>
                    <select data-ai-length>
                      ${['court', 'moyen', 'long'].map((length) => `<option value="${length}" ${MF.state.get('ai.length') === length ? 'selected' : ''}>${esc(length)}</option>`).join('')}
                    </select>
                  </label>
                </div>
                <label class="field">
                  <span class="label">Ton</span>
                  <select data-ai-tone>
                    ${['professionnel', 'cordial', 'direct', 'commercial', 'technique', 'ferme'].map((tone) => `<option value="${tone}" ${MF.state.get('ai.tone') === tone ? 'selected' : ''}>${esc(tone)}</option>`).join('')}
                  </select>
                </label>
              </div>
              <button class="btn primary block" data-ai-generate style="margin-top:var(--s-3)">${svg('wand', 15)} Generer le brouillon</button>
              <div class="hint" data-ai-note style="margin-top:6px">Fournisseur actif : <strong>${esc(MF.state.get('ai.activeProviderId', 'groq'))}</strong>. Configurez la cle dans Redaction IA.</div>
            </div>

            <div class="card">
              <header><span class="title">${svg('clipboard', 15)} Snippets</span><button class="btn ghost sm" data-go="snippets">Gerer</button></header>
              <div class="stack tight" data-snippet-list>
                ${local.snippets.length
                  ? local.snippets
                      .slice(0, 6)
                      .map((snippet) => `<button class="module" data-insert-snippet-id="${esc(snippet.id)}"><span class="ico">${svg('clipboard', 14)}</span><span class="txt"><span class="n">${esc(snippet.title)}</span><span class="d">${esc(String(snippet.body || '').slice(0, 54))}</span></span></button>`)
                      .join('')
                  : '<div class="hint">Aucun snippet. Creez-en pour inserer vos blocs recurrents en un clic.</div>'}
              </div>
            </div>

            <div class="card">
              <header><span class="title">${svg('template', 15)} Modeles</span><button class="btn ghost sm" data-go="templates">Gerer</button></header>
              <div class="stack tight">
                ${local.templates.length
                  ? local.templates
                      .slice(0, 5)
                      .map((template) => `<button class="module" data-use-template="${esc(template.id)}"><span class="ico">${svg('template', 14)}</span><span class="txt"><span class="n">${esc(template.name)}</span><span class="d">${esc(template.subject || 'sans objet')}</span></span></button>`)
                      .join('')
                  : '<div class="hint">Aucun modele enregistre.</div>'}
              </div>
            </div>

            <div class="card flat">
              <header><span class="title">${svg('shield', 15)} Cadre d'usage</span></header>
              <p class="hint">Envoyez a des destinataires qui attendent votre message. Pas de contournement de filtre antispam, pas d'usurpation d'expediteur : ces techniques detruisent la delivrabilite de votre domaine — et sont illicites dans la plupart des juridictions. Le detail est dans <span class="mono">LEGAL.md</span>.</p>
            </div>
          </aside>
        </div>`;
    },

    async mount({ host }) {
      const drafts = readDraft();
      const editor = host.querySelector('[data-editor]');
      this.unsubs = [];

      /* An empty paragraph would defeat the :empty placeholder in CSS. */
      if (!editor.textContent.trim() && !editor.querySelector('img, hr, table, ul, ol, blockquote')) editor.innerHTML = '';

      const profiles = local.profiles;
      const profile = profiles.profiles.find((item) => item.id === profiles.activeProfileId) || profiles.profiles[0];

      const from = host.querySelector('[data-from]');
      const fromName = host.querySelector('[data-from-name]');
      if (profile && !from.value) from.value = profile.from || profile.user || '';
      if (profile && !fromName.value) fromName.value = profile.fromName || MF.state.get('send.defaultFromName', '');

      MF.ui.onClick(host, '[data-go]', (target) => {
        MF.router.go(target.dataset.go, target.dataset.goParams ? JSON.parse(target.dataset.goParams) : {});
      });
      MF.ui.onClick(host, '[data-palette]', () => MF.palette.open());

      /* toolbar */
      MF.ui.onClick(host, '[data-cmd]', (target) => {
        const [command, argument] = target.dataset.cmd.split(':');
        if (command === 'createLink') {
          const url = window.prompt('URL du lien (https://...)');
          if (!url || !/^https?:\/\//i.test(url)) return;
          document.execCommand('createLink', false, url);
        } else if (command === 'h3') {
          document.execCommand('formatBlock', false, 'h3');
        } else {
          document.execCommand(command, false, argument);
        }
        editor.focus();
        saveDraft({ html: editor.innerHTML });
      });

      MF.ui.onClick(host, '[data-toggle-source]', (target) => {
        const showingSource = target.classList.toggle('on');
        const current = editor.innerHTML;
        if (showingSource) {
          editor.dataset.rich = current;
          editor.textContent = current.replace(/<br\s*\/?>/gi, '\n');
          editor.style.whiteSpace = 'pre-wrap';
        } else {
          editor.innerHTML = editor.textContent;
          editor.dataset.rich = '';
          editor.style.whiteSpace = '';
        }
        editor.focus();
      });

      MF.ui.onClick(host, '[data-insert-snippet]', () => {
        modal({
          title: 'Inserer un snippet',
          body: local.snippets.length
            ? `<div class="stack tight">${local.snippets
                .map((snippet) => `<button class="module" data-pick="${esc(snippet.id)}"><span class="ico">${svg('clipboard', 14)}</span><span class="txt"><span class="n">${esc(snippet.title)}</span><span class="d">${esc(String(snippet.body || '').slice(0, 80))}</span></span></button>`)
                .join('')}</div>`
            : `<div class="hint">Aucun snippet enregistre.</div>`,
          onMount: ({ node, close }) => {
            MF.ui.onClick(node, '[data-pick]', (target) => {
              const snippet = local.snippets.find((item) => item.id === target.dataset.pick);
              if (snippet) insertAtCursor(editor, snippet.body.replace(/\n/g, '<br>'));
              close(null);
            });
          }
        });
      });

      MF.ui.onClick(host, '[data-insert-snippet-id]', (target) => {
        const snippet = local.snippets.find((item) => item.id === target.dataset.insertSnippetId);
        if (snippet) insertAtCursor(editor, snippet.body.replace(/\n/g, '<br>'));
        saveDraft({ html: editor.innerHTML });
      });

      MF.ui.onClick(host, '[data-load-template]', () => openTemplatePicker(editor, host));

      MF.ui.onClick(host, '[data-use-template]', (target) => {
        const template = local.templates.find((item) => item.id === target.dataset.useTemplate);
        if (!template) return;
        editor.innerHTML = template.html;
        host.querySelector('[data-subject]').value = template.subject || '';
        saveDraft({ html: editor.innerHTML, subject: template.subject });
        notify.ok('Modele charge', template.name);
      });

      /* attachments */
      MF.ui.onClick(host, '[data-attach]', async () => {
        const files = await MF.api.app.pickFiles();
        const rejected = files.filter((file) => file.error);
        for (const file of files) {
          if (file.error) continue;
          if (!local.attachments.some((item) => item.filename === file.filename && item.size === file.size)) {
            local.attachments.push(file);
          }
        }
        if (rejected.length) notify.warn('Fichiers ignores', rejected.map((file) => `${file.filename}: ${file.error}`).join(', '));
        MF.router.reload();
      });

      MF.ui.onClick(host, '[data-drop-attachment]', (target) => {
        local.attachments.splice(Number(target.dataset.dropAttachment), 1);
        MF.router.reload();
      });

      /* persistence of plain fields */
      host.querySelectorAll('[data-from],[data-from-name],[data-to],[data-cc],[data-bcc],[data-subject]').forEach((field) => {
        field.addEventListener('input', () => {
          saveDraft({
            from: host.querySelector('[data-from]').value,
            fromName: host.querySelector('[data-from-name]').value,
            to: host.querySelector('[data-to]').value,
            cc: host.querySelector('[data-cc]').value,
            bcc: host.querySelector('[data-bcc]').value,
            subject: host.querySelector('[data-subject]').value
          });
        });
      });
      editor.addEventListener('input', MF.ui.debounce(() => saveDraft({ html: editor.innerHTML }), 500));

      /* actions */
      MF.ui.onClick(host, '[data-test]', async (target) => {
        MF.ui.busy(target, true);
        target.dataset.busyLabel = 'Test en cours...';
        const result = await MF.api.smtp.verify({ profileId: local.profiles.activeProfileId }).catch(() => null);
        MF.ui.busy(target, false);
        if (!result) return;
        if (result.ok) notify.ok(`Connexion validee en ${result.ms} ms`, result.message);
        else notify.error('Test de connexion echoue', `${result.message}${result.hint ? ` — ${result.hint}` : ''}`);
      });

      MF.ui.onClick(host, '[data-preview]', () => {
        const html = editor.innerHTML;
        modal({
          title: 'Apercu du message',
          size: 'wide',
          body: `<div class="stack"><div class="kv"><span class="k">Objet</span><span class="v">${esc(host.querySelector('[data-subject]').value || '(vide)')}</span></div><iframe class="preview-frame" style="min-height:420px" sandbox srcdoc="${MF.ui.attr(`<html><body style="font-family:Segoe UI,sans-serif;font-size:14px;line-height:1.6;color:#111;padding:18px">${html}</body></html>`)}"></iframe></div>`,
          actions: [{ label: 'Fermer' }]
        });
      });

      MF.ui.onClick(host, '[data-save-template]', async () => {
        const name = await MF.ui.promptModal({ title: 'Enregistrer le modele', label: 'Nom du modele', placeholder: 'Relance devis' });
        if (!name) return;
        await MF.api.templates.save({
          name,
          subject: host.querySelector('[data-subject]').value,
          html: editor.innerHTML,
          category: 'personnel'
        });
        local.templates = await MF.api.templates.list();
        notify.ok('Modele enregistre', name);
      });

      MF.ui.onClick(host, '[data-to-campaign]', () => {
        MF.state.handoff = { subject: host.querySelector('[data-subject]').value, html: editor.innerHTML };
        MF.router.go('campaign');
      });

      MF.ui.onClick(host, '[data-reset]', async () => {
        const ok = await MF.ui.confirm({ title: 'Vider le brouillon', message: 'Le contenu de l\'editeur et les champs seront effaces.', confirmLabel: 'Vider', kind: 'danger' });
        if (!ok) return;
        localStorage.removeItem(DRAFT_KEY);
        local.attachments = [];
        MF.router.reload();
      });

      MF.ui.onClick(host, '[data-ai-generate]', async (target) => {
        const brief = host.querySelector('[data-ai-brief]').value.trim();
        if (!brief) {
          notify.warn('Decrivez le message a rediger');
          host.querySelector('[data-ai-brief]').focus();
          return;
        }
        MF.ui.busy(target, true);
        target.dataset.busyLabel = 'Generation...';
        const result = await MF.api.ai
          .draft({
            brief,
            language: host.querySelector('[data-ai-lang]').value,
            tone: host.querySelector('[data-ai-tone]').value,
            length: host.querySelector('[data-ai-length]').value,
            senderName: host.querySelector('[data-from-name]').value,
            context: `Expediteur: ${host.querySelector('[data-from]').value || 'non precise'}.`
          })
          .catch(() => null);
        MF.ui.busy(target, false);
        if (!result) return;
        if (result.subject) host.querySelector('[data-subject]').value = result.subject;
        editor.innerHTML = result.html || `<p>${esc(result.text || '')}</p>`;
        saveDraft({ html: editor.innerHTML, subject: host.querySelector('[data-subject]').value });
        notify.ok(`Brouillon genere via ${result.provider || 'fournisseur'}`, result.notes || 'Relisez avant envoi — vous restez responsable du contenu.');
      });

      MF.ui.onClick(host, '[data-send]', async (target) => {
        const message = collect(host, editor);
        if (!message.to.length) {
          notify.warn('Destinataire manquant');
          return;
        }
        if (!message.from) {
          notify.warn('Adresse d\'expedition manquante');
          return;
        }
        target.dataset.busyLabel = 'Envoi...';
        MF.ui.busy(target, true);
        const result = await MF.api.smtp.send({ profileId: local.profiles.activeProfileId, message }).catch(() => null);
        MF.ui.busy(target, false);
        const box = host.querySelector('[data-result]');
        if (!result) {
          box.innerHTML = `<div class="banner error">${svg('error', 16)}<div><strong>Envoi interrompu.</strong> Verifiez le profil et le journal.</div></div>`;
          return;
        }
        if (result.ok) {
          box.innerHTML = `
            <div class="banner ok">${svg('check', 16)}<div style="flex:1">
              <strong>Message accepte en ${esc(String(result.ms))} ms.</strong><br>
              Identifiant : <span class="mono">${esc(result.id || 'n/a')}</span><br>
              Reponse du serveur : <span class="mono">${esc(String(result.response || '').slice(0, 180))}</span>
            </div>
            <button class="btn sm" data-copy-id="${esc(result.id || '')}">${svg('copy', 14)} Copier l'ID</button></div>`;
          notify.ok('Message envoye', message.to.join(', '));
          MF.state.refresh();
        } else {
          box.innerHTML = `<div class="banner error">${svg('error', 16)}<div><strong>Refus du serveur.</strong><br>${esc(result.error || 'erreur inconnue')}</div></div>`;
          notify.error('Echec de l\'envoi', result.error);
        }
      });

      MF.ui.onClick(host, '[data-copy-id]', (target) => copy(target.dataset.copyId, 'Identifiant copie'));

      /* restore / refresh snippets and templates */
      local.snippets = await MF.api.snippets.list();
      local.templates = await MF.api.templates.list();
      if (!drafts.savedAt) notify.info('Nouveau message', 'Le brouillon est conserve localement pendant la saisie.');
    },

    unmount() {
      (this.unsubs || []).forEach((fn) => fn());
    }
  });

  function collect(host, editor) {
    const html = editor.dataset.rich !== undefined && editor.style.whiteSpace === 'pre-wrap'
      ? editor.textContent.replace(/\n/g, '<br>')
      : editor.innerHTML;
    return {
      from: host.querySelector('[data-from]').value.trim(),
      fromName: host.querySelector('[data-from-name]').value.trim(),
      to: host.querySelector('[data-to]').value.split(/[,;\s]+/).filter(Boolean),
      cc: host.querySelector('[data-cc]').value.split(/[,;\s]+/).filter(Boolean),
      bcc: host.querySelector('[data-bcc]').value.split(/[,;\s]+/).filter(Boolean),
      subject: host.querySelector('[data-subject]').value,
      html,
      text: htmlToText(html),
      attachments: local.attachments
    };
  }

  function openTemplatePicker(editor, host) {
    modal({
      title: 'Charger un modele',
      size: 'wide',
      body: local.templates.length
        ? `<div class="stack tight">${local.templates
            .map(
              (template) => `
          <button class="module" data-pick="${esc(template.id)}">
            <span class="ico">${svg('template', 14)}</span>
            <span class="txt"><span class="n">${esc(template.name)}</span><span class="d">${esc(template.subject || 'sans objet')} — ${esc(template.category || 'general')}</span></span>
          </button>`
            )
            .join('')}</div>`
        : `<div class="hint">Aucun modele. Enregistrez le contenu actuel avec « Enregistrer comme modele ».</div>`,
      onMount: ({ node, close }) => {
        MF.ui.onClick(node, '[data-pick]', (target) => {
          const template = local.templates.find((item) => item.id === target.dataset.pick);
          if (template) {
            editor.innerHTML = template.html;
            host.querySelector('[data-subject]').value = template.subject || '';
            saveDraft({ html: template.html, subject: template.subject });
            notify.ok('Modele charge', template.name);
          }
          close(null);
        });
      }
    });
  }
})();
