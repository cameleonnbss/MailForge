/* language: JavaScript, file: src/renderer/js/views/campaign.js
   Campaign view: consent list, per-recipient personalisation, a hard 1 s floor
   between messages, unsubscribe footer and suppression list. Live progress with
   a cancellable queue. */
(function () {
  const MF = (window.MF = window.MF || {});
  const { svg } = MF.icons;
  const { esc, notify, number } = MF.ui;

  const local = {
    recipients: [],
    parsed: { invalid: 0, duplicates: 0, suppressed: 0 },
    running: false,
    results: [],
    summary: null,
    profiles: { profiles: [], activeProfileId: null }
  };

  function policyBanner() {
    return `
      <div class="banner warn">
        ${svg('shield', 16)}
        <div>
          <strong>Liste consentie uniquement.</strong> Cet envoi groupe respecte un delai minimal d'une seconde entre chaque message,
          ajoute une ligne de desinscription et filtre votre liste d'exclusion. Il n'embarque aucune technique de contournement
          de filtre antispam : l'usurpation d'expediteur et les domaines brulees sont illicites et detruisent durablement la
          delivrabilite d'un domaine. Voir <span class="mono">LEGAL.md</span>.
        </div>
      </div>`;
  }

  function recipientPreview() {
    if (!local.recipients.length) {
      return MF.ui.empty('users', 'Aucun destinataire', 'Collez une liste ou importez un CSV (colonnes email et nom optionnelles).');
    }
    return `<div class="stack tight" data-recipient-list>
      ${local.recipients
        .slice(0, 60)
        .map(
          (row) => `
        <div class="recipient-row">
          <button class="btn ghost icon sm" data-remove="${esc(row.email)}" title="Retirer">${svg('close', 12)}</button>
          <span class="nm">${esc(row.nom || row.name || '—')}</span>
          <span class="mail">${esc(row.email)}</span>
        </div>`
        )
        .join('')}
      ${local.recipients.length > 60 ? `<div class="hint">${local.recipients.length - 60} autres destinataires non affiches.</div>` : ''}
    </div>`;
  }

  MF.router.register({
    id: 'campaign',
    title: 'Campagne',
    group: 'E-mail',
    icon: 'users',
    description: 'Envoi a une liste consentie, espace et suivi.',

    async preload() {
      local.profiles = await MF.api.smtp.profiles();
    },

    render() {
      const handoff = MF.state.handoff;
      if (handoff) MF.state.handoff = null;
      const throttle = MF.state.get('send.throttleMs', 4000);
      const jitter = MF.state.get('send.jitterMs', 1500);
      const profiles = local.profiles.profiles;
      const profile = profiles.find((item) => item.id === local.profiles.activeProfileId) || profiles[0];
      const suppression = MF.state.get('suppression', []);
      const estimate = local.recipients.length
        ? MF.ui.duration(local.recipients.length * (throttle + jitter / 2))
        : '—';

      return `
        <div class="page-head">
          <div class="titles">
            <h1>Campagne</h1>
            <p class="sub">Un message personnalise par destinataire, envoye l'un apres l'autre avec un delai maitrise. Le rythme compte plus que la vitesse : un domaine qui envoie trop vite est filtre.</p>
          </div>
          <div class="actions">
            <span class="pill ${profile ? 'accent' : 'warn'}">${svg('database', 12)} ${esc(profile?.label || 'aucun profil')}</span>
            <button class="btn" data-go="settings" data-go-params='{"tab":"send"}'>${svg('settings', 15)} Profils</button>
          </div>
        </div>

        ${policyBanner()}

        <div class="split" style="margin-top:var(--s-5)">
          <div class="stack">
            <div class="card">
              <header>
                <span class="title">${svg('users', 15)} Destinataires</span>
                <div class="row">
                  <span class="pill">${number(local.recipients.length)} retenus</span>
                  ${local.parsed.duplicates ? `<span class="pill warn">${local.parsed.duplicates} doublons</span>` : ''}
                  ${local.parsed.invalid ? `<span class="pill warn">${local.parsed.invalid} invalides</span>` : ''}
                  ${local.parsed.suppressed ? `<span class="pill error">${local.parsed.suppressed} exclus</span>` : ''}
                </div>
              </header>

              <label class="field">
                <span class="label">Coller la liste (une adresse par ligne, ou CSV email;nom)</span>
                <textarea data-list rows="7" placeholder="marie.dubois@example.com;Marie
lucas@example.net;Lucas
..."></textarea>
              </label>

              <div class="row" style="margin-top:var(--s-3)">
                <button class="btn" data-parse>${svg('list', 15)} Analyser</button>
                <button class="btn" data-import>${svg('upload', 15)} Importer un CSV</button>
                <button class="btn ghost" data-dedupe>${svg('filter', 15)} Dedoublonner</button>
                <button class="btn ghost danger" data-clear>${svg('trash', 15)} Vider</button>
              </div>

              <div style="margin-top:var(--s-4)" data-recipients>${recipientPreview()}</div>
            </div>

            <div class="card">
              <header><span class="title">${svg('mail', 15)} Message</span></header>
              <label class="field">
                <span class="label">Objet</span>
                <input type="text" data-subject value="${esc(handoff?.subject || '')}" placeholder="Variables acceptees : {{nom}} {{email}}">
              </label>
              <label class="field" style="margin-top:var(--s-3)">
                <span class="label">Corps HTML</span>
                <textarea data-body rows="10" placeholder="<p>Bonjour {{nom}},</p>&#10;<p>...</p>">${esc(handoff?.html || '')}</textarea>
              </label>
              <div class="row" style="margin-top:var(--s-3)">
                <span class="hint">Variables disponibles : {{nom}} · {{email}} · colonnes du CSV. Chaque envoi part separement — aucun Cci groupe.</span>
                <span class="spacer"></span>
                <button class="btn ghost sm" data-preview>${svg('eye', 14)} Apercu</button>
              </div>
            </div>

            <div class="card">
              <header>
                <span class="title">${svg('clock', 15)} Rythme et conformite</span>
                <span class="pill accent">${number(profiles.length)} profil(s)</span>
              </header>
              <div class="stack tight">
                <label class="field">
                  <span class="label">Delai entre deux messages — ${throttle} ms (minimum 1000)</span>
                  <input type="range" min="1000" max="30000" step="500" value="${throttle}" data-throttle style="padding:0">
                </label>
                <label class="field">
                  <span class="label">Gigue aleatoire — ${jitter} ms</span>
                  <input type="range" min="0" max="10000" step="250" value="${jitter}" data-jitter style="padding:0">
                </label>
                <label class="check"><input type="checkbox" data-footer ${MF.state.get('send.unsubscribeFooter', true) ? 'checked' : ''}> Ajouter la ligne de desinscription en pied de message</label>
                <label class="field">
                  <span class="label">Texte de desinscription</span>
                  <input type="text" data-footer-text value="${esc(MF.state.get('send.unsubscribeText', ''))}">
                </label>
                <div class="kv"><span class="k">Liste d'exclusion</span><span class="v">${number(suppression.length)} adresse(s)</span></div>
                <div class="kv"><span class="k">Duree estimee</span><span class="v">${estimate}</span></div>
              </div>
            </div>
          </div>

          <aside class="stack">
            <div class="card accent">
              <header><span class="title">${svg('play', 15)} Lancement</span></header>
              <div class="stack tight">
                <div class="kv"><span class="k">Destinataires</span><span class="v">${number(local.recipients.length)}</span></div>
                <div class="kv"><span class="k">Profil</span><span class="v">${esc(profile?.label || '—')}</span></div>
                <div class="kv"><span class="k">Delai</span><span class="v">${throttle} ms + ${jitter} ms</span></div>
                <div class="kv"><span class="k">Duree estimee</span><span class="v">${estimate}</span></div>
              </div>
              <div data-progress style="margin-top:var(--s-3)"></div>
              <div class="row" style="margin-top:var(--s-4)">
                <button class="btn primary block" data-start ${!profile || !local.recipients.length ? 'disabled' : ''}>${svg('play', 15)} Demarrer l'envoi</button>
              </div>
              <button class="btn danger block" data-stop ${local.running ? '' : 'disabled'} style="margin-top:var(--s-2)">${svg('stop', 15)} Arreter</button>
              <div class="hint" style="margin-top:var(--s-3)">L'arret prend effet apres le message en cours. Le progres reste dans le journal ci-dessous et dans l'historique.</div>
            </div>

            <div class="card">
              <header><span class="title">${svg('terminal', 15)} Progres</span><span class="pill" data-counter>0 / ${number(local.recipients.length)}</span></header>
              <div class="log-view" data-run-log style="height:300px">
                ${local.results.length
                  ? local.results
                      .slice(-60)
                      .map(
                        (row) => `<div class="log-line ${row.ok ? 'success' : 'error'}"><span class="ts">${esc(MF.ui.time(row.ts))}</span><span class="lvl">${row.ok ? 'OK' : 'FAIL'}</span><span class="msg">${esc(row.email)}${row.error ? ` — ${esc(row.error)}` : ''}</span></div>`
                      )
                      .join('')
                  : '<div class="hint" style="color:var(--text-3)">En attente.</div>'}
              </div>
              <div data-summary style="margin-top:var(--s-3)">
                ${local.summary ? summaryBlock(local.summary) : ''}
              </div>
            </div>

            <div class="card flat">
              <header><span class="title">${svg('shield', 15)} Rappel utile</span></header>
              <p class="hint">Vos envois passent mieux si votre domaine publie SPF, DKIM et DMARC, si les liens pointent vers le meme domaine que l'expediteur, et si les desinscriptions sont honorees. Ces trois points font plus pour la delivrabilite que n'importe quel artifice d'en-tete.</p>
            </div>
          </aside>
        </div>`;
    },

    async mount({ host }) {
      this.unsubs = [];
      const pushLog = (row) => {
        local.results.push(row);
        const view = host.querySelector('[data-run-log]');
        if (!view) return;
        if (view.querySelector('.hint')) view.innerHTML = '';
        const line = document.createElement('div');
        line.className = `log-line ${row.ok ? 'success' : 'error'}`;
        line.innerHTML = `<span class="ts">${esc(MF.ui.time(row.ts))}</span><span class="lvl">${row.ok ? 'OK' : 'FAIL'}</span><span class="msg">${esc(row.email)}${row.error ? ` — ${esc(row.error)}` : ''}</span>`;
        view.appendChild(line);
        while (view.childElementCount > 200) view.firstElementChild.remove();
        view.scrollTop = view.scrollHeight;
      };

      this.unsubs.push(
        MF.api.onEvent(({ type, payload }) => {
          if (type === 'bulk:start') {
            local.running = true;
            const counter = host.querySelector('[data-counter]');
            if (counter) counter.textContent = `0 / ${payload.total}`;
          } else if (type === 'bulk:progress') {
            pushLog({ ...payload, ts: Date.now() });
            const counter = host.querySelector('[data-counter]');
            if (counter) counter.textContent = `${payload.index} / ${payload.total}`;
            const strip = host.querySelector('[data-progress]');
            if (strip) {
              strip.innerHTML = `
                <div class="progress-strip">
                  <div class="row between"><span class="hint">Envoi en cours</span><span class="hint">${payload.index} / ${payload.total}</span></div>
                  <div class="meter"><i style="width:${Math.round((payload.index / payload.total) * 100)}%"></i></div>
                </div>`;
            }
          } else if (type === 'bulk:done') {
            local.running = false;
            local.summary = payload;
            const summary = host.querySelector('[data-summary]');
            if (summary) summary.innerHTML = summaryBlock(payload);
            host.querySelector('[data-start]')?.removeAttribute('disabled');
            host.querySelector('[data-stop]')?.setAttribute('disabled', 'disabled');
            notify[payload.failed ? 'warn' : 'ok'](
              payload.aborted ? 'Campagne interrompue' : 'Campagne terminee',
              `${payload.sent} envoye(s), ${payload.failed} echec(s), ${payload.skipped} exclu(s) en ${MF.ui.duration(payload.elapsedMs)}`
            );
            MF.state.refresh();
          }
        })
      );

      MF.ui.onClick(host, '[data-go]', (target) => MF.router.go(target.dataset.go, target.dataset.goParams ? JSON.parse(target.dataset.goParams) : {}));

      async function parseList() {
        const text = host.querySelector('[data-list]').value;
        const parsed = await MF.api.smtp.parseList(text);
        local.recipients = parsed.recipients;
        local.parsed = { invalid: parsed.invalid, duplicates: parsed.duplicates, suppressed: parsed.suppressed };
        host.querySelector('[data-recipients]').innerHTML = recipientPreview();
        if (!text.trim()) notify.info('Liste vide');
        else notify.ok(`${local.recipients.length} destinataire(s) retenus`, `${parsed.invalid} ligne(s) invalide(s), ${parsed.duplicates} doublon(s), ${parsed.suppressed} exclu(s)`);
        refreshStart();
      }

      function refreshStart() {
        const button = host.querySelector('[data-start]');
        const profile = local.profiles.profiles.find((item) => item.id === local.profiles.activeProfileId) || local.profiles.profiles[0];
        if (button) button.disabled = !profile || !local.recipients.length || local.running;
      }

      MF.ui.onClick(host, '[data-parse]', parseList);
      MF.ui.onClick(host, '[data-import]', async () => {
        const files = await MF.api.app.pickFiles();
        const csv = files.find((file) => /\.(csv|txt|tsv)$/i.test(file.filename));
        if (!csv) {
          if (files.length) notify.warn('Format inattendu', 'Choisissez un fichier .csv ou .txt');
          return;
        }
        host.querySelector('[data-list]').value = decodeURIComponent(escape(atob(csv.content)));
        parseList();
      });
      MF.ui.onClick(host, '[data-dedupe]', () => {
        const seen = new Set();
        local.recipients = local.recipients.filter((row) => {
          const key = row.email.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        host.querySelector('[data-recipients]').innerHTML = recipientPreview();
        notify.ok('Liste dedoublonnee', `${local.recipients.length} adresses uniques`);
      });
      MF.ui.onClick(host, '[data-clear]', () => {
        local.recipients = [];
        local.parsed = { invalid: 0, duplicates: 0, suppressed: 0 };
        local.results = [];
        host.querySelector('[data-list]').value = '';
        host.querySelector('[data-recipients]').innerHTML = recipientPreview();
        host.querySelector('[data-run-log]').innerHTML = '<div class="hint" style="color:var(--text-3)">En attente.</div>';
        host.querySelector('[data-summary]').innerHTML = '';
        refreshStart();
      });
      MF.ui.onClick(host, '[data-remove]', (target) => {
        local.recipients = local.recipients.filter((row) => row.email !== target.dataset.remove);
        host.querySelector('[data-recipients]').innerHTML = recipientPreview();
        refreshStart();
      });

      function paintRange(input) {
        if (!input) return;
        const min = Number(input.min) || 0;
        const max = Number(input.max) || 100;
        const ratio = max === min ? 1 : (Number(input.value) - min) / (max - min);
        input.style.setProperty('--range-progress', `${Math.round(ratio * 100)}%`);
      }

      const throttleInput = host.querySelector('[data-throttle]');
      const jitterInput = host.querySelector('[data-jitter]');
      [throttleInput, jitterInput].forEach(paintRange);

      throttleInput?.addEventListener('input', (event) => {
        const value = Number(event.target.value);
        event.target.closest('.field').querySelector('.label').textContent = `Delai entre deux messages — ${value} ms (minimum 1000)`;
        paintRange(event.target);
        updateEstimate();
      });
      jitterInput?.addEventListener('input', (event) => {
        const value = Number(event.target.value);
        event.target.closest('.field').querySelector('.label').textContent = `Gigue aleatoire — ${value} ms`;
        paintRange(event.target);
        updateEstimate();
      });

      function updateEstimate() {
        const throttle = Number(host.querySelector('[data-throttle]').value);
        const jitter = Number(host.querySelector('[data-jitter]').value);
        const estimate = MF.ui.duration(local.recipients.length * (throttle + jitter / 2));
        const rows = host.querySelectorAll('.kv');
        rows.forEach((row) => {
          if (row.querySelector('.k')?.textContent.includes('Duree')) row.querySelector('.v').textContent = estimate;
          if (row.querySelector('.k')?.textContent.includes('Delai')) row.querySelector('.v').textContent = `${throttle} ms + ${jitter} ms`;
        });
      }

      MF.ui.onClick(host, '[data-preview]', () => {
        const html = host.querySelector('[data-body]').value.replace(/\{\{\s*nom\s*\}\}/g, 'Marie').replace(/\{\{\s*email\s*\}\}/g, 'marie@example.com');
        MF.ui.modal({
          title: 'Apercu (variables remplacees)',
          size: 'wide',
          body: `<iframe class="preview-frame" style="min-height:380px" sandbox srcdoc="${MF.ui.attr(`<html><body style="font-family:Segoe UI,sans-serif;font-size:14px;line-height:1.6;padding:18px;color:#111">${html}</body></html>`)}"></iframe>`,
          actions: [{ label: 'Fermer' }]
        });
      });

      MF.ui.onClick(host, '[data-start]', async (target) => {
        if (!local.recipients.length) {
          notify.warn('Liste vide', 'Analysez ou importez une liste avant de lancer.');
          return;
        }
        const subject = host.querySelector('[data-subject]').value.trim();
        const body = host.querySelector('[data-body]').value;
        if (!subject && !body) {
          notify.warn('Message vide');
          return;
        }
        const throttle = Number(host.querySelector('[data-throttle]').value);
        const jitter = Number(host.querySelector('[data-jitter]').value);
        const confirmed = await MF.ui.confirm({
          title: 'Lancer la campagne',
          message: `${local.recipients.length} messages vont partir depuis ${local.profiles.profiles[0]?.label || 'votre profil'}, espaces de ${throttle} ms.`,
          detail: 'Vous confirmez disposer du consentement de ces destinataires et respecter la legislation applicable a votre envoi.',
          confirmLabel: 'Demarrer',
          kind: 'primary'
        });
        if (!confirmed) return;

        await MF.state.merge({
          send: {
            throttleMs: throttle,
            jitterMs: jitter,
            unsubscribeFooter: host.querySelector('[data-footer]').checked,
            unsubscribeText: host.querySelector('[data-footer-text]').value
          }
        });

        local.results = [];
        host.querySelector('[data-run-log]').innerHTML = '';
        host.querySelector('[data-summary]').innerHTML = '';
        target.disabled = true;
        host.querySelector('[data-stop]').removeAttribute('disabled');
        local.running = true;

        const result = await MF.api.smtp
          .bulkStart({
            profileId: local.profiles.activeProfileId,
            recipients: local.recipients,
            throttleMs: throttle,
            jitterMs: jitter,
            message: { subject, html: body }
          })
          .catch(() => null);
        local.running = false;
        target.disabled = false;
        if (result) {
          local.summary = result;
          host.querySelector('[data-summary]').innerHTML = summaryBlock(result);
        }
      });

      MF.ui.onClick(host, '[data-stop]', async () => {
        await MF.api.smtp.bulkCancel();
        notify.warn('Arret demande', "La campagne s'arrete apres le message en cours.");
      });

      refreshStart();
    },

    unmount() {
      (this.unsubs || []).forEach((fn) => fn());
    }
  });

  function summaryBlock(summary) {
    const rate = summary.total ? Math.round((summary.sent / summary.total) * 100) : 0;
    return `
      <div class="card flat">
        <div class="stack tight">
          <div class="row between"><span class="hint">${summary.aborted ? 'Campagne interrompue' : 'Campagne terminee'}</span><span class="pill ${summary.failed ? 'warn' : 'ok'}">${rate} %</span></div>
          <div class="meter"><i style="width:${rate}%"></i></div>
          <div class="kv"><span class="k">Envoyes</span><span class="v">${number(summary.sent)}</span></div>
          <div class="kv"><span class="k">Echecs</span><span class="v">${number(summary.failed)}</span></div>
          <div class="kv"><span class="k">Exclus (liste d'exclusion)</span><span class="v">${number(summary.skipped)}</span></div>
          <div class="kv"><span class="k">Duree reelle</span><span class="v">${esc(MF.ui.duration(summary.elapsedMs))}</span></div>
        </div>
      </div>`;
  }
})();
