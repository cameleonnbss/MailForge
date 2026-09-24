/* language: JavaScript, file: src/renderer/js/ui.js
   Shared UI kit: escaping, formatting, toasts, modals, confirm, copy, downloads. */
(function () {
  const MF = (window.MF = window.MF || {});
  const { svg } = MF.icons;

  /* ------------------------------------------------------------ escape -- */

  function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function attr(value) {
    return esc(value).replace(/`/g, '&#96;');
  }

  /* ---------------------------------------------------------- formats -- */

  const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  const timeFmt = new Intl.DateTimeFormat('fr-FR', { timeStyle: 'medium' });

  function date(value) {
    if (!value) return '—';
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return dateFmt.format(parsed);
  }

  function time(value) {
    const parsed = value instanceof Date ? value : new Date(value || Date.now());
    return timeFmt.format(parsed);
  }

  function relative(value) {
    const parsed = new Date(value).getTime();
    if (Number.isNaN(parsed)) return '—';
    const diff = Date.now() - parsed;
    const table = [
      [31536000000, 'an', 'ans'],
      [2592000000, 'mois', 'mois'],
      [86400000, 'j', 'j'],
      [3600000, 'h', 'h'],
      [60000, 'min', 'min'],
      [1000, 's', 's']
    ];
    for (const [ms, one, many] of table) {
      if (Math.abs(diff) >= ms) {
        const count = Math.round(diff / ms);
        return `il y a ${Math.abs(count)} ${Math.abs(count) > 1 ? many : one}`;
      }
    }
    return "a l'instant";
  }

  function bytes(value) {
    const size = Number(value) || 0;
    if (size < 1024) return `${size} o`;
    if (size < 1048576) return `${(size / 1024).toFixed(1)} Ko`;
    if (size < 1073741824) return `${(size / 1048576).toFixed(1)} Mo`;
    return `${(size / 1073741824).toFixed(2)} Go`;
  }

  function number(value) {
    return new Intl.NumberFormat('fr-FR').format(Number(value) || 0);
  }

  function duration(ms) {
    const total = Math.max(0, Math.round(Number(ms) / 1000));
    if (total < 60) return `${total} s`;
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    if (minutes < 60) return `${minutes} min ${String(seconds).padStart(2, '0')} s`;
    return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
  }

  function initials(value) {
    return String(value || '?')
      .split(/[\s.@_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  }

  /* ----------------------------------------------------------- toasts -- */

  function toast({ type = 'info', title = '', message = '', timeout } = {}) {
    const host = document.getElementById('toasts');
    if (!host) return { close() {} };
    const icons = { info: 'info', ok: 'check', success: 'check', warn: 'alert', error: 'error' };
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.innerHTML = `
      ${svg(icons[type] || 'info', 16)}
      <div class="body">
        ${title ? `<div class="t-title">${esc(title)}</div>` : ''}
        ${message ? `<div class="t-msg">${esc(message)}</div>` : ''}
      </div>`;
    host.appendChild(node);
    const life = timeout ?? (type === 'error' ? 8000 : type === 'warn' ? 6000 : 3800);
    const timer = setTimeout(() => close(), life);

    function close() {
      clearTimeout(timer);
      if (!node.isConnected) return;
      node.classList.add('out');
      setTimeout(() => node.remove(), 220);
    }

    node.addEventListener('click', close);
    return { close };
  }

  const notify = {
    ok: (title, message) => toast({ type: 'ok', title, message }),
    info: (title, message) => toast({ type: 'info', title, message }),
    warn: (title, message) => toast({ type: 'warn', title, message }),
    error: (title, message) => toast({ type: 'error', title, message })
  };

  /* ----------------------------------------------------------- modals -- */

  let openModals = 0;

  function modal({ title, body = '', actions = [], size = '', onMount, closable = true } = {}) {
    const host = document.getElementById('modal-host');
    const node = document.createElement('div');
    node.className = `modal ${size}`;
    node.innerHTML = `
      <header>
        <h3>${esc(title)}</h3>
        ${closable ? `<button class="btn ghost icon" data-close aria-label="Fermer">${svg('close', 14)}</button>` : ''}
      </header>
      <div class="body">${typeof body === 'string' ? body : ''}</div>
      ${actions.length ? '<footer></footer>' : ''}`;

    const bodyHost = node.querySelector('.body');
    if (typeof body !== 'string' && body instanceof Node) bodyHost.appendChild(body);
    const footer = node.querySelector('footer');

    host.innerHTML = '';
    host.appendChild(node);
    host.classList.add('open');
    openModals += 1;

    function close(result) {
      host.classList.remove('open');
      host.innerHTML = '';
      openModals = Math.max(0, openModals - 1);
      document.removeEventListener('keydown', onKey);
      node.dispatchEvent(new CustomEvent('modal:closed', { detail: result }));
    }

    function onKey(event) {
      if (event.key === 'Escape' && closable) {
        event.stopPropagation();
        close(null);
      }
    }
    document.addEventListener('keydown', onKey);

    for (const action of actions) {
      const button = document.createElement('button');
      button.className = `btn ${action.kind || ''} ${action.position === 'left' ? 'left' : ''}`;
      button.innerHTML = `${action.icon ? svg(action.icon, 15) : ''}${esc(action.label)}`;
      if (action.position === 'left') button.style.marginRight = 'auto';
      button.addEventListener('click', async () => {
        if (action.onClick) {
          const outcome = await action.onClick({ close, node, button });
          if (outcome === false) return;
        }
        if (action.keepOpen !== true) close(action.value ?? action.label);
      });
      (action.position === 'left' ? footer : footer || node).appendChild(button);
      if (!footer) button.style.marginLeft = 'auto';
    }

    if (node.querySelector('[data-close]')) {
      node.querySelector('[data-close]').addEventListener('click', () => close(null));
    }
    host.onclick = (event) => {
      if (event.target === host && closable) close(null);
    };

    if (onMount) onMount({ node, close, body: bodyHost });
    const focusTarget = node.querySelector('[data-autofocus]') || node.querySelector('input, textarea, select, button.primary');
    if (focusTarget) setTimeout(() => focusTarget.focus(), 30);
    return { close, node, body: bodyHost };
  }

  function confirm({ title = 'Confirmer', message = '', confirmLabel = 'Confirmer', kind = 'primary', detail = '' } = {}) {
    return new Promise((resolve) => {
      const instance = modal({
        title,
        size: 'slim',
        body: `<p style="color:var(--text-2);line-height:1.6">${esc(message)}</p>${detail ? `<div class="banner warn">${svg('alert', 16)}<div>${detail}</div></div>` : ''}`,
        actions: [
          { label: 'Annuler', onClick: () => resolve(false) },
          { label: confirmLabel, kind, onClick: () => resolve(true) }
        ]
      });
      instance.node.addEventListener('modal:closed', () => resolve(false), { once: true });
    });
  }

  function promptModal({ title, label, value = '', placeholder = '', multiline = false, confirmLabel = 'Valider' } = {}) {
    return new Promise((resolve) => {
      const input = multiline
        ? `<textarea data-autofocus rows="6" placeholder="${attr(placeholder)}">${esc(value)}</textarea>`
        : `<input data-autofocus type="text" value="${attr(value)}" placeholder="${attr(placeholder)}">`;
      const instance = modal({
        title,
        size: multiline ? '' : 'slim',
        body: `<label class="field"><span class="label">${esc(label || '')}</span>${input}</label>`,
        actions: [
          { label: 'Annuler', onClick: () => resolve(null) },
          {
            label: confirmLabel,
            kind: 'primary',
            onClick: ({ node }) => {
              const field = node.querySelector('[data-autofocus]');
              resolve(field.value);
            }
          }
        ]
      });
      instance.node.addEventListener('modal:closed', () => resolve(null), { once: true });
    });
  }

  /* ------------------------------------------------------------ copies -- */

  async function copy(text, label = 'Copie') {
    const value = String(text ?? '');
    if (!value) {
      notify.warn('Rien a copier');
      return false;
    }
    try {
      await navigator.clipboard.writeText(value);
      notify.ok(label, value.length > 60 ? `${value.slice(0, 57)}...` : value);
      return true;
    } catch {
      const area = document.createElement('textarea');
      area.value = value;
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      if (ok) notify.ok(label);
      else notify.error('Copie impossible');
      return ok;
    }
  }

  async function saveText(content, defaultPath, filters) {
    const result = await MF.api.app.saveFile({ content, defaultPath, filters });
    if (result?.saved) notify.ok('Fichier enregistre', result.filePath);
    else notify.info('Export annule');
    return result;
  }

  /* ------------------------------------------------------------- misc -- */

  function debounce(fn, wait = 250) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  function onClick(host, selector, handler) {
    host.addEventListener('click', (event) => {
      const target = event.target.closest(selector);
      if (target && host.contains(target)) handler(target, event);
    });
  }

  function busy(button, state = true) {
    if (!button) return;
    if (state) {
      if (button.dataset.original === undefined) button.dataset.original = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `<span class="spinner"></span><span>${esc(button.dataset.busyLabel || 'En cours...')}</span>`;
    } else {
      button.disabled = false;
      if (button.dataset.original !== undefined) button.innerHTML = button.dataset.original;
    }
  }

  function empty(icon, title, hint = '') {
    return `<div class="empty">${svg(icon, 34)}<div class="title">${esc(title)}</div>${hint ? `<div class="hint">${esc(hint)}</div>` : ''}</div>`;
  }

  function statLine(value, label, sub = '') {
    return `<div class="stat"><div class="value">${value}</div><div class="legend">${esc(label)}${sub ? `<span class="hint">${esc(sub)}</span>` : ''}</div></div>`;
  }

  MF.ui = {
    esc,
    attr,
    date,
    time,
    relative,
    bytes,
    number,
    duration,
    initials,
    toast,
    notify,
    modal,
    confirm,
    promptModal,
    copy,
    saveText,
    debounce,
    onClick,
    busy,
    empty,
    statLine,
    get modalOpen() {
      return openModals > 0;
    }
  };
})();
