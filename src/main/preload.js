// language: JavaScript, file: src/main/preload.js
// The only surface the renderer can reach. contextIsolation is on, so nothing
// from Node leaks in: every capability is an explicit, enumerated channel.
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

async function call(channel, payload) {
  const response = await ipcRenderer.invoke(channel, payload);
  if (response && response.ok === false) throw new Error(response.error || 'Erreur inconnue');
  return response ? response.data : null;
}

function onEvent(handler) {
  const listener = (_event, message) => handler(message);
  ipcRenderer.on('app:event', listener);
  return () => ipcRenderer.removeListener('app:event', listener);
}

contextBridge.exposeInMainWorld('mailforge', {
  app: {
    info: () => call('app:info'),
    openExternal: (url) => call('app:open-external', { url }),
    openPath: (target) => call('app:open-path', { target }),
    pickFiles: () => call('app:pick-files'),
    saveFile: (payload) => call('app:save-file', payload),
    readFile: (filePath) => call('app:read-file', { filePath }),
    stats: () => call('app:stats')
  },
  window: {
    minimize: () => call('window:minimize'),
    toggleMaximize: () => call('window:toggle-maximize'),
    close: () => call('window:close'),
    state: () => call('window:state')
  },
  store: {
    all: () => call('store:all'),
    get: (key, fallback) => call('store:get', { key, fallback }),
    set: (key, value) => call('store:set', { key, value }),
    merge: (patch) => call('store:merge', { patch }),
    reset: (keepSecrets) => call('store:reset', { keepSecrets }),
    exportAll: () => call('store:export'),
    importAll: (json) => call('store:import', { json })
  },
  logs: {
    write: (level, message, scope) => call('log:write', { level, message, scope }),
    list: (options) => call('log:list', options),
    clear: () => call('log:clear')
  },
  smtp: {
    profiles: () => call('smtp:profiles'),
    saveProfile: (profile) => call('smtp:profile-save', { profile }),
    deleteProfile: (id) => call('smtp:profile-delete', { id }),
    setActive: (id) => call('smtp:profile-active', { id }),
    verify: (payload) => call('smtp:verify', payload),
    send: (payload) => call('smtp:send', payload),
    bulkStart: (payload) => call('smtp:bulk-start', payload),
    bulkCancel: () => call('smtp:bulk-cancel'),
    parseList: (text) => call('smtp:parse-list', { text })
  },
  suppression: {
    list: () => call('suppression:list'),
    add: (entries) => call('suppression:add', { entries }),
    remove: (email) => call('suppression:remove', { email })
  },
  history: {
    list: (options) => call('history:list', options),
    clear: () => call('history:clear'),
    export: (format) => call('history:export', { format })
  },
  tempmail: {
    providers: () => call('tempmail:providers'),
    create: (providerId) => call('tempmail:create', { providerId }),
    boxes: () => call('tempmail:boxes'),
    poll: (boxId) => call('tempmail:poll', { boxId }),
    read: (boxId, messageId) => call('tempmail:read', { boxId, messageId }),
    destroy: (boxId) => call('tempmail:destroy', { boxId }),
    forgetAll: () => call('tempmail:forget-all'),
    setProvider: (providerId) => call('tempmail:set-provider', { providerId })
  },
  ai: {
    catalog: () => call('ai:catalog'),
    saveProvider: (payload) => call('ai:save-provider', payload),
    setActive: (id) => call('ai:active', { id }),
    draft: (payload) => call('ai:draft', payload),
    test: (payload) => call('ai:test', payload)
  },
  tools: {
    catalog: () => call('tools:catalog'),
    run: (id, params) => call('tools:run', { id, params })
  },
  snippets: {
    list: () => call('snippets:list'),
    save: (snippet) => call('snippets:save', { snippet }),
    remove: (id) => call('snippets:delete', { id })
  },
  templates: {
    list: () => call('templates:list'),
    save: (template) => call('templates:save', { template }),
    remove: (id) => call('templates:delete', { id })
  },
  onEvent
});
