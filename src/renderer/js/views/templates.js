/* language: JavaScript, file: src/renderer/js/views/templates.js
   Email template library: reusable subjects and HTML bodies with {{variables}},
   inserted into the composer or into a campaign. */
(function () {
  const MF = (window.MF = window.MF || {});
  const { svg } = MF.icons;
  const { esc, notify, copy } = MF.ui;

  let templates = [];

  const STARTERS = [
    {
      name: 'Premier contact',
      category: 'prospection',
      subject: 'Prise de contact — {{societe}}',
      html: '<p>Bonjour {{nom}},</p>\n<p>Je me permets de vous ecrire au sujet de {{sujet}}. Nous accompagnons des equipes comme la votre sur ce point precis.</p>\n<p>Seriez-vous disponible pour un echange de quinze minutes cette semaine ?</p>\n<p>Bien cordialement,<br>Votre nom<br>Votre societe</p>'
    },
    {
      name: 'Relance courtoise',
      category: 'suivi',
      subject: 'Re: votre demande',
      html: '<p>Bonjour {{nom}},</p>\n<p>Je reviens vers vous concernant mon message precedent. Je sais que les journees sont chargees : un simple mot de votre part suffit.</p>\n<p>Bonne journee,</p>'
    },
    {
      name: 'Confirmation de commande',
      category: 'transactionnel',
      subject: 'Confirmation — commande {{numero}}',
      html: '<p>Bonjour {{nom}},</p>\n<p>Nous confirmons la prise en charge de votre commande <strong>{{numero}}</strong>.</p>\n<ul><li>Montant : {{montant}}</li><li>Livraison estimee : {{delai}}</li></ul>\n<p>Merci de votre confiance.</p>'
    },
    {
      name: 'Notification interne',
      category: 'interne',
      subject: '[{{equipe}}] Point hebdomadaire',
      html: '<p>Bonjour a tous,</p>\n<p>Voici les points de la semaine :</p>\n<ul><li>Avancement :</li><li>Blocages :</li><li>Prochaines etapes :</li></ul>\n<p>Merci.</p>'
    },
    {
      name: 'Desinscription confirmee',
      category: 'conformite',
      subject: 'Votre desinscription est enregistree',
      html: '<p>Bonjour {{nom}},</p>\n<p>Votre adresse {{email}} a bien ete retiree de nos envois. Aucun message ne vous sera adresse a nouveau.</p>\n<p>Si cette demande est une erreur, repondez simplement a ce message.</p>'
    }
  ];

  const CATEGORY_LABEL = {
    prospection: 'Prospection',
    suivi: 'Suivi',
    transactionnel: 'Transactionnel',
    interne: 'Interne',
    conformite: 'Conformite',
    personnel: 'Personnel',
    general: 'General'
  };

  function card(template) {
    const variables = [...new Set((`${template.subject} ${template.html}`.match(/\{\{\s*[\w.]+\s*\}\}/g) || []).map((v) => v.replace(/[{}]/g, '').trim()))];
    return `
      <article class="card hoverable" data-open="${esc(template.id)}">
        <header>
          <span class="title">${svg('template', 15)} ${esc(template.name)}</span>
          <span class="pill">${esc(CATEGORY_LABEL[template.category] || template.category || 'general')}</span>
        </header>
        <div class="stack tight">
          <div class="kv"><span class="k">Objet</span><span class="v">${esc(template.subject || '—')}</span></div>
          <div class="hint" style="max-height:52px;overflow:hidden">${esc(String(template.html || '').replace(/<[^>]+>/g, ' ').slice(0, 150))}</div>
          ${variables.length ? `<div class="row">${variables.slice(0, 6).map((variable) => `<span class="chip mono">{{${esc(variable)}}}</span>`).join('')}</div>` : ''}
        </div>
        <div class="card-foot">
          <span class="hint">${esc(MF.ui.relative(template.updatedAt || Date.now()))}</span>
          <div class="row">
            <button class="btn ghost sm" data-edit="${esc(template.id)}">${svg('save', 13)} Modifier</button>
            <button class="btn ghost sm" data-delete="${esc(template.id)}">${svg('trash', 13)}</button>
          </div>
        </div>
      </article>`;
  }

  MF.router.register({
    id: 'templates',
    title: 'Modeles',
    group: 'Outils',
    icon: 'template',
    description: 'Modeles e-mail reutilisables.',

    async preload() {
      templates = await MF.api.templates.list();
    },

    render() {
      const empty = !templates.length;
      return `
        <div class="page-head">
          <div class="titles">
            <h1>Modeles e-mail</h1>
            <p class="sub">Un modele est un objet plus un corps HTML. Les variables entre doubles accolades sont remplacees a l'envoi, par les colonnes de votre liste ou par vos champs.</p>
          </div>
          <div class="actions">
            <button class="btn" data-starters ${empty ? '' : 'disabled'}>${svg('sparkles', 15)} Charger les 5 modeles de depart</button>
            <button class="btn primary" data-new>${svg('plus', 15)} Nouveau modele</button>
          </div>
        </div>

        ${empty
          ? MF.ui.empty('template', 'Aucun modele', 'Chargez les modeles de depart pour voir la structure attendue, ou creez le votre.')
          : `<div class="grid">${templates.map(card).join('')}</div>`}`;
    },

    async mount({ host }) {
      MF.ui.onClick(host, '[data-new]', () => openEditor(null, host));
      MF.ui.onClick(host, '[data-edit]', (target, event) => {
        event.stopPropagation();
        openEditor(templates.find((item) => item.id === target.dataset.edit), host);
      });
      MF.ui.onClick(host, '[data-open]', (target) => openEditor(templates.find((item) => item.id === target.dataset.open), host));
      MF.ui.onClick(host, '[data-delete]', async (target, event) => {
        event.stopPropagation();
        const template = templates.find((item) => item.id === target.dataset.delete);
        const ok = await MF.ui.confirm({ title: 'Supprimer le modele', message: template?.name, confirmLabel: 'Supprimer', kind: 'danger' });
        if (!ok) return;
        await MF.api.templates.remove(target.dataset.delete);
        templates = await MF.api.templates.list();
        notify.ok('Modele supprime');
        MF.router.reload();
      });
      MF.ui.onClick(host, '[data-starters]', async () => {
        const ok = await MF.ui.confirm({
          title: 'Charger les modeles de depart',
          message: 'Cinq modeles de base seront ajoutes a votre bibliotheque. Vous pourrez les modifier ou les supprimer.',
          confirmLabel: 'Ajouter'
        });
        if (!ok) return;
        for (const starter of STARTERS) await MF.api.templates.save(starter);
        templates = await MF.api.templates.list();
        notify.ok('5 modeles ajoutes');
        MF.router.reload();
      });
    }
  });

  function openEditor(template, host) {
    const editing = Boolean(template);
    const instance = MF.ui.modal({
      title: editing ? `Modele — ${template.name}` : 'Nouveau modele',
      size: 'wide',
      body: `
        <div class="stack">
          <div class="row" style="gap:var(--s-3);align-items:flex-end">
            <label class="field" style="flex:1;min-width:180px"><span class="label">Nom</span>
              <input type="text" data-name data-autofocus value="${esc(template?.name || '')}" placeholder="Relance devis"></label>
            <label class="field" style="width:200px"><span class="label">Categorie</span>
              <select data-category>
                ${Object.entries(CATEGORY_LABEL)
                  .map(([value, label]) => `<option value="${value}" ${template?.category === value ? 'selected' : ''}>${label}</option>`)
                  .join('')}
              </select></label>
          </div>
          <label class="field"><span class="label">Objet</span>
            <input type="text" data-subject-input value="${esc(template?.subject || '')}" placeholder="Prise de contact — {{societe}}"></label>
          <label class="field"><span class="label">Corps HTML</span>
            <textarea data-html rows="12" placeholder="<p>Bonjour {{nom}},</p>">${esc(template?.html || '')}</textarea></label>
          <div class="hint">Variables disponibles a l'envoi : {{nom}}, {{email}}, plus toute colonne presente dans votre CSV.</div>
        </div>`,
      actions: [
        { label: 'Copier le HTML', position: 'left', onClick: ({ node }) => copy(node.querySelector('[data-html]').value, 'HTML copie'), keepOpen: true },
        { label: 'Annuler' },
        {
          label: editing ? 'Enregistrer' : 'Creer',
          kind: 'primary',
          onClick: async ({ node, close }) => {
            const name = node.querySelector('[data-name]').value.trim();
            if (!name) {
              notify.warn('Nom obligatoire');
              return false;
            }
            await MF.api.templates.save({
              id: template?.id,
              name,
              subject: node.querySelector('[data-subject-input]').value,
              html: node.querySelector('[data-html]').value,
              category: node.querySelector('[data-category]').value
            });
            templates = await MF.api.templates.list();
            notify.ok(editing ? 'Modele mis a jour' : 'Modele cree', name);
            MF.router.reload();
          }
        }
      ]
    });
    return instance;
  }
})();
