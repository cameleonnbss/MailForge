/* language: JavaScript, file: src/renderer/js/router.js
   Hash router. Views register themselves with a render()/mount() pair; the
   router owns the host element, scroll reset and the nav highlight. */
(function () {
  const MF = (window.MF = window.MF || {});

  const router = {
    views: new Map(),
    current: null,
    params: {},
    host: null,
    listeners: new Set(),
    token: 0,

    register(view) {
      if (!view || !view.id) throw new Error('Vue invalide.');
      router.views.set(view.id, view);
      return view;
    },

    list() {
      return [...router.views.values()];
    },

    groups() {
      const order = ['Pilotage', 'E-mail', 'Boites', 'Outils', 'Systeme'];
      const map = new Map();
      for (const view of router.views.values()) {
        const group = view.group || 'Autres';
        if (!map.has(group)) map.set(group, []);
        map.get(group).push(view);
      }
      return [...map.entries()].sort((a, b) => {
        const ai = order.indexOf(a[0]);
        const bi = order.indexOf(b[0]);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
    },

    start(host) {
      router.host = host;
      window.addEventListener('hashchange', () => router.resolve());
      router.resolve();
    },

    go(id, params = {}) {
      const query = Object.keys(params).length ? `?${new URLSearchParams(params)}` : '';
      const target = `#/${id}${query}`;
      if (window.location.hash === target) router.resolve();
      else window.location.hash = target;
    },

    reload() {
      router.resolve(true);
    },

    async resolve(force = false) {
      const raw = window.location.hash.replace(/^#\/?/, '') || 'dashboard';
      const [id, queryString] = raw.split('?');
      const view = router.views.get(id) || router.views.get('dashboard');
      if (!view) return;
      const params = Object.fromEntries(new URLSearchParams(queryString || ''));
      if (!force && router.current?.id === view.id && JSON.stringify(router.params) === JSON.stringify(params)) return;

      router.current = view;
      router.params = params;
      const host = router.host;
      const token = ++router.token;

      try {
        /* Views declare preload() for the data their render() reads synchronously,
           so the first paint is complete instead of an empty shell. */
        if (typeof view.preload === 'function') await view.preload({ params });
        if (token !== router.token) return;

        host.innerHTML = '';
        const node = document.createElement('section');
        node.className = 'view';
        node.dataset.view = view.id;
        const markup = view.render({ params, store: MF.state.snapshot });
        node.innerHTML = typeof markup === 'string' ? markup : '';
        host.appendChild(node);
        host.scrollTop = 0;
        if (view.mount) await view.mount({ host: node, params });
      } catch (error) {
        host.innerHTML = `<div class="view"><div class="banner error">${MF.icons.svg('error', 16)}<div><strong>Cette vue a echoue.</strong><br>${MF.ui.esc(error.message)}</div></div></div>`;
        MF.api.log('error', `Vue ${view.id}: ${error.message}`, 'router');
      }

      for (const listener of router.listeners) listener(view, params);
      document.title = `MailForge — ${view.title}`;
    },

    onChange(listener) {
      router.listeners.add(listener);
      return () => router.listeners.delete(listener);
    }
  };

  MF.router = router;
})();
