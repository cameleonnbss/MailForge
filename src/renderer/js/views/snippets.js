/* language: JavaScript, file: src/renderer/js/views/snippets.js
   Snippet manager: short reusable blocks (signatures, mentions legales,
   instructions de desinscription) copied or sent to the composer. */
(function () {
  const MF = (window.MF = window.MF || {});
  const { svg } = MF.icons;
  const { esc, notify, copy } = MF.ui;

  let snippets = [];
  let query = '';

  function filtered() {
    if (!query) return snippets;
    const needle = query.toLowerCase();
    return snippets.filter(
      (snippet) =>
        snippet.title.toLowerCase().includes(needle) ||
        snippet.body.toLowerCase().includes(needle) ||
        (snippet.tags || []).some((tag) => tag.includes(needle))
    );
  }

  function row(snippet) {
    return `
      <article class="card flat" style="padding:var(--s-3)">
        <div class="row between">
          <div style="min-width:0">
            <div style="font-weight:560;color:var(--text-1)">${esc(snippet.title)}</div>
            <div class="row" style="margin-top:4px">${(snippet.tags || []).map((tag) => `<span class="pill">${esc(tag)}</span>`).join('')}</div>
          </div>
          <div class="row" style="flex:none">
            <button class="btn ghost sm" data-copy="${esc(snippet.id)}">${svg('copy', 13)} Copier</button>
            <button class="btn ghost sm" data-compose="${esc(snippet.id)}">${svg('send', 13)} Composer</button>
            <button class="btn ghost sm" data-edit="${esc(snippet.id)}">${svg('save', 13)}</button>
            <button class="btn ghost sm" data-delete="${esc(snippet.id)}">${svg('trash', 13)}</button>
          </div>
        </div>
        <pre class="code" style="margin-top:var(--s-3);max-height:130px">${esc(snippet.body)}</pre>
      </article>`;
  }

  MF.router.register({
    id: 'snippets',
    title: 'Snippets',
    group: 'Outils',
    icon: 'clipboard',
    description: 'Blocs de texte courts et reutilisables.',

    async preload() {
      snippets = await MF.api.snippets.list();
    },

    render() {
      const list = filtered();
      return `
        <div class="page-head">
          <div class="titles">
            <h1>Snippets</h1>
            <p class="sub">Signature, mention legale, instructions de reponse, adresse postale : tout ce que vous retapez se stocke ici et s'insere en un clic dans le compositeur.</p>
          </div>
          <div class="actions">
            <label class="field" style="width:220px"><input type="search" data-search value="${esc(query)}" placeholder="Rechercher..." data-autofocus></label>
            <button class="btn primary" data-new>${svg('plus', 15)} Nouveau snippet</button>
          </div>
        </div>

        ${list.length
          ? `<div class="stack tight">${list.map(row).join('')}</div>`
          : MF.ui.empty('clipboard', snippets.length ? 'Aucun resultat' : 'Aucun snippet', snippets.length ? 'Essayez un autre terme.' : 'Creez votre premier bloc reutilisable.')}`;
    },

    async mount({ host }) {
      const search = host.querySelector('[data-search]');
      if (search && query) {
        search.addEventListener(
          'input',
          MF.ui.debounce(() => {
            query = search.value;
            MF.router.reload();
          }, 250)
        );
      }
      if (search) {
        search.addEventListener('input', MF.ui.debounce((event) => {
          query = event.target.value;
          MF.router.reload();
        }, 300));
      }

      MF.ui.onClick(host, '[data-new]', () => openEditor(null, host));
      MF.ui.onClick(host, '[data-edit]', (target) => openEditor(snippets.find((item) => item.id === target.dataset.edit), host));
      MF.ui.onClick(host, '[data-copy]', (target) => {
        const snippet = snippets.find((item) => item.id === target.dataset.copy);
        if (snippet) copy(snippet.body, 'Snippet copie');
      });
      MF.ui.onClick(host, '[data-compose]', (target) => {
        const snippet = snippets.find((item) => item.id === target.dataset.compose);
        if (!snippet) return;
        MF.state.handoff = { html: `<p>${esc(snippet.body).replace(/\n/g, '<br>')}</p>` };
        MF.router.go('compose');
      });
      MF.ui.onClick(host, '[data-delete]', async (target) => {
        const snippet = snippets.find((item) => item.id === target.dataset.delete);
        const ok = await MF.ui.confirm({ title: 'Supprimer le snippet', message: snippet?.title, confirmLabel: 'Supprimer', kind: 'danger' });
        if (!ok) return;
        await MF.api.snippets.remove(target.dataset.delete);
        snippets = await MF.api.snippets.list();
        notify.ok('Snippet supprime');
        MF.router.reload();
      });
    }
  });

  function openEditor(snippet, host) {
    MF.ui.modal({
      title: snippet ? `Snippet — ${snippet.title}` : 'Nouveau snippet',
      body: `
        <div class="stack">
          <label class="field"><span class="label">Titre</span>
            <input type="text" data-title data-autofocus value="${esc(snippet?.title || '')}" placeholder="Signature"></label>
          <label class="field"><span class="label">Contenu</span>
            <textarea data-body rows="8" placeholder="Bien a vous,&#10;Prenom Nom">${esc(snippet?.body || '')}</textarea></label>
          <label class="field"><span class="label">Etiquettes (separees par des virgules)</span>
            <input type="text" data-tags value="${esc((snippet?.tags || []).join(', '))}" placeholder="signature, legal"></label>
        </div>`,
      actions: [
        { label: 'Annuler' },
        {
          label: snippet ? 'Enregistrer' : 'Creer',
          kind: 'primary',
          onClick: async ({ node }) => {
            const title = node.querySelector('[data-title]').value.trim();
            if (!title) {
              notify.warn('Titre obligatoire');
              return false;
            }
            await MF.api.snippets.save({
              id: snippet?.id,
              title,
              body: node.querySelector('[data-body]').value,
              tags: node.querySelector('[data-tags]').value
            });
            snippets = await MF.api.snippets.list();
            notify.ok(snippet ? 'Snippet mis a jour' : 'Snippet cree', title);
            MF.router.reload();
          }
        }
      ]
    });
  }
})();
