/* language: JavaScript, file: src/renderer/js/api.js
   Thin facade over the preload bridge: adds naming, logging and uniform error
   reporting. Every call returns real data or throws Error(message). */
(function () {
  const MF = (window.MF = window.MF || {});
  const bridge = window.mailforge;

  if (!bridge) {
    throw new Error('Pont applicatif indisponible: preload.js non charge.');
  }

  let logSink = null;

  function setLogSink(fn) {
    logSink = fn;
  }

  function log(level, message, scope = 'ui') {
    if (logSink) logSink({ ts: new Date().toISOString(), level, message, scope });
    bridge.logs.write(level, message, scope).catch(() => {});
  }

  /** Wrap a call so failures surface as toasts instead of silent rejections. */
  function guard(label, fn, { silent = false } = {}) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        const message = error?.message || String(error);
        if (!silent && MF.ui) MF.ui.notify.error(label, message);
        log('error', `${label}: ${message}`);
        throw error;
      }
    };
  }

  const api = {
    bridge,
    isMock: Boolean(bridge.__mock),
    log,
    setLogSink,
    guard,
    app: bridge.app,
    window: bridge.window,
    store: bridge.store,
    logs: bridge.logs,
    smtp: {
      ...bridge.smtp,
      verify: guard('Test de connexion', bridge.smtp.verify),
      send: guard('Envoi', bridge.smtp.send),
      bulkStart: guard('Campagne', bridge.smtp.bulkStart)
    },
    suppression: bridge.suppression,
    history: bridge.history,
    tempmail: {
      ...bridge.tempmail,
      create: guard('Nouvelle boite', bridge.tempmail.create),
      poll: guard('Releve des messages', bridge.tempmail.poll, { silent: true }),
      read: guard('Lecture du message', bridge.tempmail.read)
    },
    ai: {
      ...bridge.ai,
      draft: guard('Redaction IA', bridge.ai.draft),
      test: guard('Test IA', bridge.ai.test)
    },
    tools: bridge.tools,
    snippets: bridge.snippets,
    templates: bridge.templates,
    onEvent: bridge.onEvent
  };

  MF.api = api;
})();
