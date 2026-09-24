/* language: JavaScript, file: src/renderer/js/icons.js
   Inline SVG icon set (Lucide-style geometry) — no icon font, no dependency. */
(function () {
  const MF = (window.MF = window.MF || {});

  const PATHS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    send: '<path d="M14.5 9.5 21 3m0 0h-5m5 0v5"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2.5 6.5 8.4 6a2 2 0 0 0 2.2 0l8.4-6"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11"/>',
    sparkles: '<path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M19 15l.8 2L22 17.8 20 18.6 19.2 21l-.8-2.4L16 17.8l2.2-.8z"/>',
    template: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
    clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0 5.2 5.2l-8.6 8.6a2.4 2.4 0 0 1-3.4 0l-1.8-1.8a2.4 2.4 0 0 1 0-3.4z"/><path d="M14.7 6.3 17 4l3 3-2.3 2.3"/>',
    history: '<path d="M3 3v6h6"/><path d="M3.5 9a9 9 0 1 0 2.6-6.4"/>',
    terminal: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.3a2 2 0 1 1-4 0V21a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.4-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.4 1z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8h.01"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    error: '<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/>',
    play: '<path d="M6 4l14 8-14 8z"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m11 12 8-8 3 3-2 2-2-2"/><path d="m14 9 3 3"/>',
    hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
    code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    fingerprint: '<path d="M12 11a3 3 0 0 0-3 3v3M15 14v3a4 4 0 0 1-.5 2M12 4a8 8 0 0 1 8 8M4 12a8 8 0 0 1 4-6.9M7 12v4a4 4 0 0 0 .5 2M18.5 18.5A6 6 0 0 1 12 21"/>',
    type: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
    brackets: '<path d="M8 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2M16 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2"/>',
    palette: '<path d="M12 21a9 9 0 1 1 0-18c4.9 0 9 3.6 9 8 0 2.2-1.8 4-4 4h-1.8a2 2 0 0 0-1.5 3.3A1.7 1.7 0 0 1 12 21z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/>',
    diff: '<path d="M12 3v18"/><path d="M7 8H4m3-3v6M18 16h3m-3-3v6"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l3-4 3 3 4-6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
    paragraph: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14 21 3"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    filter: '<path d="M3 4h18l-7 8v6l-4 2v-8z"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    wand: '<path d="m15 4 5 5L9 20H4v-5z"/><path d="m14 5 5 5"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    tag: '<path d="M20.6 13.4 12 22l-9-9V4h9l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>',
    minimize: '<path d="M5 12h14"/>',
    maximize: '<rect x="5" y="5" width="14" height="14" rx="1.6"/>',
    restore: '<rect x="4" y="8" width="12" height="12" rx="1.4"/><path d="M8 8V5.5A1.5 1.5 0 0 1 9.5 4h9A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H16"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.9 7.9"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 22H20v-2.5"/>',
    heart: '<path d="M19 5.5a5 5 0 0 0-7 .5 5 5 0 0 0-7-.5A5 5 0 0 0 5 13l7 7 7-7a5 5 0 0 0 0-7.5z"/>',
    stamp: '<path d="M5 21h14M6 17h12v4H6zM9 13h6l-.5-4.5A3 3 0 0 0 12 6a3 3 0 0 0-2.5 2.5z"/>'
  };

  function svg(name, size = 16, extra = '') {
    const d = PATHS[name] || PATHS.info;
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
  }

  MF.icons = { svg, PATHS, names: Object.keys(PATHS) };
})();
