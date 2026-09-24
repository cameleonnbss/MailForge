/* language: JavaScript, file: src/renderer/js/views/tools.js
   Tools bench. The catalog is data-driven (one entry per tool); each panel
   declares its own controls and a render function for the result. */
(function () {
  const MF = (window.MF = window.MF || {});
  const { svg } = MF.icons;
  const { esc, notify, copy, saveText } = MF.ui;

  let catalog = null;
  let lastResult = null;

  const flags = (list) =>
    list
      .map(
        (flag) => `<div class="flag ${esc(flag.level)}"><div><div class="t">${esc(flag.title)}</div><div class="d">${esc(flag.detail)}</div></div></div>`
      )
      .join('');

  /* ------------------------------------------------------------ panels -- */

  const PANELS = {
    'fake-data': {
      controls: () => `
        <div class="row" style="gap:var(--s-3);align-items:flex-end">
          <label class="field" style="width:120px"><span class="label">Langue</span>
            <select data-p="locale"><option value="fr">FR</option><option value="en">EN</option></select></label>
          <label class="field" style="width:120px"><span class="label">Nombre</span>
            <input type="number" data-p="count" value="10" min="1" max="500"></label>
          <label class="field" style="flex:1;min-width:150px"><span class="label">Type</span>
            <select data-p="kind"><option value="person">Identite complete</option><option value="email">E-mail seul</option></select></label>
        </div>`,
      run: (result, context) => {
        const rows = result.rows || [];
        if (!rows.length) return '<div class="hint">Aucune ligne.</div>';
        const columns = Object.keys(rows[0]);
        return `
          <div class="table-wrap table-scroll"><table class="data">
            <thead><tr>${columns.map((column) => `<th>${esc(column)}</th>`).join('')}</tr></thead>
            <tbody>${rows
              .map((row) => `<tr>${columns.map((column) => `<td class="${/email|mail/i.test(column) ? 'mono' : ''}">${esc(row[column])}</td>`).join('')}</tr>`)
              .join('')}</tbody>
          </table></div>
          <div class="row" style="margin-top:var(--s-3)">
            <button class="btn sm" data-export="csv">${svg('download', 13)} CSV</button>
            <button class="btn sm" data-export="json">${svg('download', 13)} JSON</button>
            <button class="btn sm" data-copy-result>${svg('copy', 13)} Copier le JSON</button>
          </div>`;
      }
    },

    password: {
      controls: () => `
        <div class="row" style="gap:var(--s-3);align-items:flex-end">
          <label class="field" style="flex:1;min-width:150px"><span class="label">Mode</span>
            <select data-p="mode"><option value="random">Caracteres aleatoires</option><option value="passphrase">Phrase de passe</option></select></label>
          <label class="field" style="width:120px"><span class="label">Longueur</span>
            <input type="number" data-p="length" value="24" min="8" max="256"></label>
          <label class="field" style="width:110px"><span class="label">Mots</span>
            <input type="number" data-p="words" value="4" min="3" max="10"></label>
        </div>
        <div class="row" style="margin-top:var(--s-3)">
          <label class="check"><input type="checkbox" data-p="upper" checked> Majuscules</label>
          <label class="check"><input type="checkbox" data-p="numbers" checked> Chiffres</label>
          <label class="check"><input type="checkbox" data-p="symbols" checked> Symboles</label>
          <label class="check"><input type="checkbox" data-p="excludeAmbiguous" checked> Exclure I l 1 O 0</label>
        </div>`,
      run: (result) => {
        const strength = result.strength || { label: '—', score: 0, bits: 0 };
        return `
          <pre class="code" style="font-size:15px;letter-spacing:.02em">${esc(result.password || '')}</pre>
          <div class="stack tight" style="margin-top:var(--s-3)">
            <div class="row between"><span class="hint">Entropie estimee</span><span class="pill ${strength.score >= 3 ? 'ok' : strength.score === 2 ? 'warn' : 'error'}">${esc(strength.label)} · ${esc(String(result.entropyBits || strength.bits))} bits</span></div>
            <div class="meter"><i style="width:${Math.min(100, ((strength.score || 1) / 4) * 100)}%"></i></div>
            <button class="btn sm" data-copy-result>${svg('copy', 13)} Copier</button>
          </div>`;
      }
    },

    uuid: {
      controls: () => `
        <div class="row" style="gap:var(--s-3);align-items:flex-end">
          <label class="field" style="flex:1;min-width:150px"><span class="label">Format</span>
            <select data-p="format"><option value="v4">UUID v4</option><option value="compact">Sans tirets</option><option value="upper">Majuscules</option><option value="nil">Nil</option></select></label>
          <label class="field" style="width:120px"><span class="label">Nombre</span>
            <input type="number" data-p="count" value="5" min="1" max="200"></label>
        </div>`,
      run: (result) => `
        <pre class="code">${esc((result.values || []).join('\n'))}</pre>
        <div class="row" style="margin-top:var(--s-3)">
          <button class="btn sm" data-copy-result>${svg('copy', 13)} Copier la liste</button>
        </div>`
    },

    lorem: {
      controls: () => `
        <div class="row" style="gap:var(--s-3);align-items:flex-end">
          <label class="field" style="width:150px"><span class="label">Paragraphes</span>
            <input type="number" data-p="paragraphs" value="3" min="1" max="40"></label>
          <label class="field" style="width:180px"><span class="label">Phrases / paragraphe</span>
            <input type="number" data-p="sentencesPerParagraph" value="4" min="1" max="20"></label>
        </div>`,
      run: (result) => `
        <div class="tabs" data-lorem-tabs style="margin-bottom:var(--s-3)">
          <button class="tab active" data-lorem="text">Texte</button>
          <button class="tab" data-lorem="html">HTML</button>
        </div>
        <pre class="code" data-lorem-view>${esc(result.text || '')}</pre>
        <div class="row" style="margin-top:var(--s-3)">
          <span class="pill">${result.stats?.words || 0} mots</span>
          <span class="pill">${result.stats?.lines || 0} lignes</span>
          <button class="btn sm" data-copy-result>${svg('copy', 13)} Copier</button>
        </div>`
    },

    base64: {
      controls: () => `
        <label class="field"><span class="label">Texte</span>
          <textarea data-p="text" rows="6" placeholder="Texte a encoder ou base64 a decoder"></textarea></label>
        <div class="row" style="margin-top:var(--s-3)">
          <label class="field" style="width:150px"><span class="label">Sens</span>
            <select data-p="mode"><option value="encode">Encoder</option><option value="decode">Decoder</option></select></label>
          <label class="check" style="align-self:flex-end;padding-bottom:9px"><input type="checkbox" data-p="urlSafe"> Variante URL-safe</label>
        </div>`,
      run: (result) => `
        <pre class="code">${esc(result.output || '')}</pre>
        <div class="row" style="margin-top:var(--s-3)"><button class="btn sm" data-copy-result>${svg('copy', 13)} Copier</button></div>`
    },

    urlencode: {
      controls: () => `
        <label class="field"><span class="label">Texte</span>
          <textarea data-p="text" rows="6"></textarea></label>
        <label class="field" style="margin-top:var(--s-3);width:150px"><span class="label">Sens</span>
          <select data-p="mode"><option value="encode">Encoder</option><option value="decode">Decoder</option></select></label>`,
      run: (result) => `
        <pre class="code">${esc(result.output || '')}</pre>
        <div class="row" style="margin-top:var(--s-3)"><button class="btn sm" data-copy-result>${svg('copy', 13)} Copier</button></div>`
    },

    hash: {
      controls: () => `
        <label class="field"><span class="label">Texte (ou ${'<'} 20 Mo entre dans le compositeur pour les fichiers)</span>
          <textarea data-p="text" rows="6"></textarea></label>`,
      run: (result) => `
        <div class="stack tight">
          ${Object.entries(result.hashes || {})
            .map(
              ([algorithm, digest]) => `
            <div class="kv"><span class="k">${esc(algorithm.toUpperCase())}</span><span class="v">${esc(digest)}</span></div>`
            )
            .join('')}
        </div>
        <div class="row" style="margin-top:var(--s-3)"><button class="btn sm" data-copy-result>${svg('copy', 13)} Copier</button></div>`
    },

    case: {
      controls: () => `
        <label class="field"><span class="label">Texte</span>
          <textarea data-p="text" rows="6"></textarea></label>
        <label class="field" style="margin-top:var(--s-3);width:200px"><span class="label">Transformation</span>
          <select data-p="mode">
            <option value="upper">MAJUSCULES</option><option value="lower">minuscules</option>
            <option value="title">Title Case</option><option value="sentence">Phrase</option>
            <option value="slug">slug-url</option><option value="snake">snake_case</option>
            <option value="camel">camelCase</option><option value="reverse">Inverser</option>
          </select></label>`,
      run: (result) => `
        <pre class="code">${esc(result.output || '')}</pre>
        <div class="row" style="margin-top:var(--s-3)"><button class="btn sm" data-copy-result>${svg('copy', 13)} Copier</button></div>`
    },

    json: {
      controls: () => `
        <label class="field"><span class="label">JSON</span>
          <textarea data-p="text" rows="10" placeholder='{"exemple": true}'></textarea></label>
        <div class="row" style="margin-top:var(--s-3)">
          <label class="field" style="width:170px"><span class="label">Sortie</span>
            <select data-p="mode"><option value="pretty">Indente</option><option value="minify">Minifie</option></select></label>
          <label class="field" style="width:120px"><span class="label">Indentation</span>
            <input type="number" data-p="indent" value="2" min="0" max="8"></label>
        </div>`,
      run: (result) => {
        if (result.ok === false) {
          return `<div class="banner error">${svg('error', 16)}<div><strong>JSON invalide</strong><br>${esc(result.error)}${result.position !== null && result.position !== undefined ? `<br>Position approximative : caractere ${result.position}` : ''}</div></div>`;
        }
        return `
          ${result.stats ? `<div class="row" style="margin-bottom:var(--s-3)"><span class="pill">${result.stats.keys} cles</span><span class="pill">profondeur ${result.stats.depth}</span><span class="pill">${MF.ui.bytes(result.stats.bytes)}</span><span class="pill">${result.stats.lines} lignes</span></div>` : ''}
          <pre class="code">${esc(result.output || '')}</pre>
          <div class="row" style="margin-top:var(--s-3)"><button class="btn sm" data-copy-result>${svg('copy', 13)} Copier</button></div>`;
      }
    },

    timestamp: {
      controls: () => `
        <div class="row" style="gap:var(--s-3);align-items:flex-end">
          <label class="field" style="flex:1;min-width:180px"><span class="label">Valeur</span>
            <input type="text" data-p="value" placeholder="1700000000 ou 2026-09-24T10:00:00Z (vide = maintenant)"></label>
          <label class="field" style="width:170px"><span class="label">Sens</span>
            <select data-p="mode"><option value="toDate">Horodatage -> date</option><option value="toStamp">Date -> horodatage</option></select></label>
          <label class="field" style="width:120px"><span class="label">Unite</span>
            <select data-p="unit"><option value="auto">Auto</option><option value="s">Secondes</option><option value="ms">Millisecondes</option></select></label>
        </div>`,
      run: (result) =>
        result.ok === false
          ? `<div class="banner error">${svg('error', 16)}<div>${esc(result.error)}</div></div>`
          : `<div class="stack tight">${Object.entries(result)
              .filter(([key]) => key !== 'ok')
              .map(([key, value]) => `<div class="kv"><span class="k">${esc(key)}</span><span class="v">${esc(String(value))}</span></div>`)
              .join('')}</div>`
    },

    color: {
      controls: () => `
        <label class="field"><span class="label">Couleur</span>
          <input type="text" data-p="value" placeholder="#3b82f6 ou rgb(59,130,246)"></label>`,
      run: (result) =>
        result.ok === false
          ? `<div class="banner error">${svg('error', 16)}<div>${esc(result.error)}</div></div>`
          : `<div class="stack tight">
              <div style="height:70px;border-radius:12px;border:1px solid var(--line);background:${esc(result.hex)}"></div>
              ${['hex', 'rgb', 'hsl']
                .map((key) => `<div class="kv"><span class="k">${key.toUpperCase()}</span><span class="v">${esc(result[key])}</span></div>`)
                .join('')}
            </div>`
    },

    diff: {
      controls: () => `
        <div class="io-grid">
          <label class="field"><span class="label">Texte A</span><textarea data-p="left" rows="10"></textarea></label>
          <label class="field"><span class="label">Texte B</span><textarea data-p="right" rows="10"></textarea></label>
        </div>`,
      run: (result) => `
        <div class="row" style="margin-bottom:var(--s-3)">
          <span class="pill">${result.total} lignes</span>
          <span class="pill ${result.changed ? 'warn' : 'ok'}">${result.changed} ligne(s) differente(s)</span>
        </div>
        <div class="table-wrap table-scroll"><table class="data">
          <thead><tr><th>#</th><th>A</th><th>B</th></tr></thead>
          <tbody>${result.rows
            .map(
              (row) => `<tr class="${row.state === 'diff' ? '' : ''}">
                <td class="num">${row.line}</td>
                <td class="mono" style="${row.state === 'diff' ? 'color:#ffd8de' : ''}">${esc(row.left)}</td>
                <td class="mono" style="${row.state === 'diff' ? 'color:#a7f3d0' : ''}">${esc(row.right)}</td>
              </tr>`
            )
            .join('')}</tbody>
        </table></div>`
    },

    headers: {
      controls: () => `
        <label class="field"><span class="label">Message brut (Source du message dans votre client)</span>
          <textarea data-p="raw" rows="12" placeholder="From: ...&#10;Received: ...&#10;&#10;corps"></textarea></label>`,
      run: (result) => {
        if (!result.ok) return `<div class="banner error">${svg('error', 16)}<div>${esc(result.error)}</div></div>`;
        return `
          <div class="stack">
            <div class="row">
              <span class="pill ${result.auth.spf === 'pass' ? 'ok' : result.auth.spf ? 'error' : 'warn'}">SPF ${esc(result.auth.spf || 'absent')}</span>
              <span class="pill ${result.auth.dkim === 'pass' ? 'ok' : result.auth.dkim ? 'error' : 'warn'}">DKIM ${esc(result.auth.dkim || 'absent')}</span>
              <span class="pill ${result.auth.dmarc === 'pass' ? 'ok' : result.auth.dmarc ? 'error' : 'warn'}">DMARC ${esc(result.auth.dmarc || 'absent')}</span>
              <span class="pill">${result.counts.headers} headers</span>
              <span class="pill">${result.counts.received} sauts</span>
              <span class="pill">${MF.ui.bytes(result.counts.bodyBytes)}</span>
            </div>
            <div class="kv"><span class="k">Objet</span><span class="v">${esc(result.subject || '—')}</span></div>
            <div class="kv"><span class="k">De</span><span class="v">${esc(result.from.name)} &lt;${esc(result.from.address)}&gt;</span></div>
            ${result.replyTo?.address ? `<div class="kv"><span class="k">Repondre a</span><span class="v">${esc(result.replyTo.address)}</span></div>` : ''}
            ${result.messageId ? `<div class="kv"><span class="k">Message-ID</span><span class="v">${esc(result.messageId)}</span></div>` : ''}
            ${result.xMailer ? `<div class="kv"><span class="k">Client</span><span class="v">${esc(result.xMailer)}</span></div>` : ''}
            ${result.duplicated.length ? `<div class="kv"><span class="k">Headers dupliques</span><span class="v">${esc(result.duplicated.map((d) => `${d.name} x${d.count}`).join(', '))}</span></div>` : ''}
            <div class="stack tight">${flags(result.flags)}</div>
            <div class="section-head"><span class="title">Chaine Received</span><span class="hint">${MF.ui.duration(result.totalDelayMs)} cumulees</span></div>
            ${result.received.length
              ? result.received
                  .map(
                    (hop) => `<div class="hop"><span class="idx">${hop.index}</span><span>${esc(hop.from || '?')} &rarr; ${esc(hop.by || '?')}</span><span class="delay ${hop.delayMs > 20000 ? 'slow' : ''}">${hop.delayMs === null ? '—' : `+${MF.ui.duration(hop.delayMs)}`}</span></div>`
                  )
                  .join('')
              : '<div class="hint">Aucun header Received : brouillon local ou export depouille.</div>'}
            ${result.body ? `<div class="section-head"><span class="title">Corps texte extrait</span></div><pre class="code">${esc(result.body)}</pre>` : ''}
          </div>`;
      }
    },

    stats: {
      controls: () => `
        <label class="field"><span class="label">Texte</span>
          <textarea data-p="text" rows="10" placeholder="Collez le texte a mesurer"></textarea></label>`,
      run: (result) => `
        <div class="grid cols-3">
          ${[
            ['Caracteres', result.characters],
            ['Sans espaces', result.charactersNoSpaces],
            ['Mots', result.words],
            ['Lignes', result.lines],
            ['Octets UTF-8', result.bytes],
            ['Lecture', `${result.readMinutes} min`]
          ]
            .map(
              ([label, value]) => `<div class="card flat" style="padding:var(--s-3)">${MF.ui.statLine(MF.ui.number(value), label)}</div>`
            )
            .join('')}
        </div>`
    }
  };

  function tile(tool) {
    return `
      <button class="tool-tile" data-tool="${esc(tool.id)}">
        <span class="ico">${svg(tool.icon, 17)}</span>
        <span class="n">${esc(tool.label)}</span>
        <span class="d">${esc(tool.description)}</span>
      </button>`;
  }

  MF.router.register({
    id: 'tools',
    title: 'Boite a outils',
    group: 'Outils',
    icon: 'wrench',
    description: 'Generateurs, encodeurs et analyseurs.',

    async preload() {
      if (!catalog) catalog = await MF.api.tools.catalog();
    },

    render({ params }) {
      const tools = catalog || [];
      const active = params.id ? tools.find((tool) => tool.id === params.id) : null;

      if (!active) {
        const groups = tools.reduce((acc, tool) => {
          acc[tool.group] = acc[tool.group] || [];
          acc[tool.group].push(tool);
          return acc;
        }, {});
        return `
          <div class="page-head">
            <div class="titles">
              <h1>Boite a outils</h1>
              <p class="sub">${tools.length} outils locaux. Aucun appel reseau, aucune donnee envoyee : tout est calcule dans l'application.</p>
            </div>
            <div class="actions">
              ${Object.keys(groups).map((group) => `<span class="pill">${esc(group)} · ${groups[group].length}</span>`).join('')}
            </div>
          </div>
          ${Object.entries(groups)
            .map(
              ([group, list]) => `
            <section class="section">
              <div class="section-head"><span class="title">${esc(group)}</span></div>
              <div class="grid tight">${list.map(tile).join('')}</div>
            </section>`
            )
            .join('')}`;
      }

      if (active.id === 'templates' || active.id === 'snippets') {
        const target = active.id;
        return `
          <div class="page-head">
            <div class="titles"><h1>${esc(active.label)}</h1><p class="sub">${esc(active.description)} Ce module a sa propre vue dediee.</p></div>
            <div class="actions">
              <button class="btn" data-back>${svg('chevron', 15)} Tous les outils</button>
              <button class="btn primary" data-go="${target}">${svg(active.icon, 15)} Ouvrir ${esc(active.label)}</button>
            </div>
          </div>`;
      }

      const panel = PANELS[active.id];
      return `
        <div class="page-head">
          <div class="titles">
            <h1>${esc(active.label)}</h1>
            <p class="sub">${esc(active.description)}</p>
          </div>
          <div class="actions">
            <span class="pill accent">${esc(active.group)}</span>
            <button class="btn ghost" data-back>${svg('chevron', 15)} Tous les outils</button>
          </div>
        </div>
        <div class="io-grid">
          <div class="card">
            <header><span class="title">${svg('filter', 15)} Parametres</span></header>
            <div data-tool-form>${panel ? panel.controls() : '<div class="hint">Outil indisponible.</div>'}</div>
            <div class="row" style="margin-top:var(--s-4)">
              <button class="btn primary" data-run>${svg('play', 15)} Executer</button>
              <button class="btn ghost" data-clear>Vider</button>
              <span class="spacer"></span>
              <span class="kbd">Ctrl Entree</span>
            </div>
          </div>
          <div class="card" style="min-height:320px">
            <header><span class="title">${svg('code', 15)} Resultat</span><span class="pill" data-timing></span></header>
            <div data-output>${MF.ui.empty('wrench', 'En attente', 'Renseignez les parametres puis lancez l\'outil.')}</div>
          </div>
        </div>`;
    },

    async mount({ host, params }) {
      MF.ui.onClick(host, '[data-tool]', (target) => MF.router.go('tools', { id: target.dataset.tool }));
      MF.ui.onClick(host, '[data-back]', () => MF.router.go('tools'));
      MF.ui.onClick(host, '[data-go]', (target) => MF.router.go(target.dataset.go));

      const active = params.id ? catalog.find((tool) => tool.id === params.id) : null;
      if (!active) return;

      const form = host.querySelector('[data-tool-form]');
      const output = host.querySelector('[data-output]');

      function collect() {
        const values = {};
        form?.querySelectorAll('[data-p]').forEach((field) => {
          values[field.dataset.p] = field.type === 'checkbox' ? field.checked : field.value;
        });
        return values;
      }

      async function execute() {
        const timing = host.querySelector('[data-timing]');
        const started = performance.now();
        try {
          const result = await MF.api.tools.run(active.id, collect());
          lastResult = result;
          const panel = PANELS[active.id];
          output.innerHTML = panel ? panel.run(result, { host }) : `<pre class="code">${esc(JSON.stringify(result, null, 2))}</pre>`;
          if (timing) timing.textContent = `${Math.round(performance.now() - started)} ms`;
          wireResult(host, result);
        } catch (error) {
          output.innerHTML = `<div class="banner error">${svg('error', 16)}<div>${esc(error.message)}</div></div>`;
        }
      }

      MF.ui.onClick(host, '[data-run]', execute);
      MF.ui.onClick(host, '[data-clear]', () => {
        form?.querySelectorAll('[data-p]').forEach((field) => {
          if (field.type === 'checkbox') field.checked = false;
          else if (field.tagName === 'SELECT') field.selectedIndex = 0;
          else if (field.type === 'number') field.value = field.defaultValue;
          else field.value = '';
        });
        output.innerHTML = MF.ui.empty('wrench', 'En attente');
      });

      host.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault();
          execute();
        }
      });

      /* Tools whose result is immediately meaningful with default parameters
         run once on mount; the rest wait for an explicit click. */
      if (PANELS[active.id] && ['fake-data', 'uuid', 'lorem', 'timestamp'].includes(active.id)) execute();
    }
  });

  function wireResult(host, result) {
    MF.ui.onClick(host, '[data-copy-result]', () => {
      const value = result.output || result.password || (result.values || []).join('\n') || result.text || result.csv || JSON.stringify(result, null, 2);
      copy(value, 'Resultat copie');
    });
    MF.ui.onClick(host, '[data-export]', async (target) => {
      const format = target.dataset.export;
      const content = format === 'csv' ? result.csv : result.json || result.output || '';
      await saveText(content, `mailforge-${Date.now()}.${format}`, [
        { name: format === 'csv' ? 'CSV' : 'JSON', extensions: [format] }
      ]);
    });
    MF.ui.onClick(host, '[data-lorem]', (target) => {
      host.querySelectorAll('[data-lorem]').forEach((button) => button.classList.toggle('active', button === target));
      const view = host.querySelector('[data-lorem-view]');
      if (view) view.textContent = target.dataset.lorem === 'html' ? result.html : result.text;
      wireResult(host, result);
    });
  }
})();
