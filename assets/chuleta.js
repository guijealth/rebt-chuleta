/* Chuleta REBT — one page in three parts: the chuleta, the UNE-EN 60617 symbols and the devices, ready to print.
   Content comes from data.js (built by tools/build.py from content/*.json).
   Printing: the pages are laid out ahead of time in #print-root (A4 landscape, 14 mm binding strip),
   hidden on screen and the only thing printed, so the browser's own Print (Ctrl+P) gives the same result. */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const el = (tag, props = {}, ...children) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else n.setAttribute(k, v);
    }
    for (const c of children.flat()) if (c != null && c !== false) n.append(c);
    return n;
  };

  const data = window.CHULETA;
  if (!data) {
    $('#screen').textContent = 'Falta data.js: ejecuta «python3 tools/build.py».';
    return;
  }
  const { cheatsheet: cheat, devices, symbols: syms } = data;
  const builtDate = new Date(`${data.built}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

  // ---------- building blocks, shared by the screen and the printed pages ----------

  // Rows are [what, value, ref]; a ref from the REBT itself (BT-xx, art.) is blue, other documents grey.
  function cheatSection(s, title = s.title) {
    const kind = (r) => (!r ? null : /^(BT-|art\.)/.test(r) ? 'rebt' : 'official');
    return el('section', { class: 'cheat-sec' },
      el('h3', {}, title, el('span', { text: s.ref || '' })),
      (s.visuals || []).map((svg) => el('figure', { class: 'cheat-visual', html: svg })),
      s.table ? el('table', { class: 'cheat-table' },
        el('thead', {}, el('tr', {}, s.table.head.map((h) => el('th', { text: h })))),
        el('tbody', {}, s.table.rows.map((r) => el('tr', {}, r.map((x) => el('td', { text: x })))))) : null,
      s.rows?.length ? el('dl', { class: 'cheat-rows' }, s.rows.map(([k, v, r]) => el('div', {},
        el('dt', { text: k }), el('dd', { text: v }), el('dd', { class: 'cheat-ref', 'data-kind': kind(r), text: r })))) : null);
  }

  function symbolTile(it) {
    return el('figure', { class: 'sym' },
      el('div', { class: 'sym-art', html: it.svg }),
      el('figcaption', {},
        el('span', { class: 'sym-name', text: it.name }),
        it.note ? el('span', { class: 'sym-note', text: it.note }) : null,
        el('span', { class: 'sym-tags' },
          el('span', { class: 'sym-iec', text: it.iec || 'compuesto' }),
          it.code ? el('span', { class: 'sym-code', text: it.code }) : null)));
  }

  function symbolSection(s, title = s.title, items = s.items.map(symbolTile)) {
    return el('section', { class: 'sym-sec' },
      el('h3', {}, title, el('span', { text: s.ref || '' })),
      el('div', { class: 'sym-grid' }, items));
  }

  // ---------- screen ----------

  function renderScreen() {
    $('#chuleta').append(
      el('h2', { class: 'part-title', id: 'chuleta-title', text: cheat.title }),
      cheat.subtitle ? el('p', { class: 'part-sub', text: cheat.subtitle }) : null,
      el('div', { class: 'cheat-grid' }, cheat.sections.map((s) => cheatSection(s))));
    $('#simbolos').append(
      el('h2', { class: 'part-title', id: 'simbolos-title', text: syms.title }),
      syms.subtitle ? el('p', { class: 'part-sub', text: syms.subtitle }) : null,
      ...syms.sections.map((s) => (s.items ? symbolSection(s) : cheatSection(s))),
      syms.credit ? el('p', { class: 'sym-credit', text: syms.credit }) : null);
    $('#dispositivos').append(
      el('h2', { class: 'part-title', id: 'dispositivos-title', text: devices.title }),
      devices.subtitle ? el('p', { class: 'part-sub', text: devices.subtitle }) : null,
      el('div', { class: 'cheat-grid' }, devices.sections.map((s) => cheatSection(s))));
    $('#foot').append(
      el('p', {}, 'Resumen para estudiar, ', el('strong', { text: 'no es un documento oficial' }),
        '. El texto que vale es el del ',
        el('a', { href: 'https://www.boe.es/biblioteca_juridica/codigos/codigo.php?id=326', text: 'REBT en el BOE' }),
        '; cada fila lleva su ITC-BT y apartado para comprobarlo.'),
      el('p', {}, syms.credit ? `${syms.credit} ` : '', `Actualizado el ${builtDate}.`));
  }

  // Search: keeps rows, table rows and symbols that contain every word; a section whose title or reference
  // matches stays whole.
  const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function search(text) {
    const words = norm(text).split(/\s+/).filter(Boolean);
    const hit = (t) => words.every((w) => norm(t).includes(w));
    let any = false;
    for (const sec of $$('#screen .cheat-sec, #screen .sym-sec')) {
      const whole = !words.length || hit(sec.querySelector('h3').textContent);
      let shown = 0;
      for (const item of $$('.cheat-rows > div, .cheat-table tbody tr, .sym', sec)) {
        item.hidden = !whole && !hit(item.textContent);
        if (!item.hidden) shown++;
      }
      const table = sec.querySelector('.cheat-table');
      if (table) table.hidden = !whole && !$$('tbody tr', table).some((r) => !r.hidden);
      sec.hidden = !whole && !shown;
      any ||= !sec.hidden;
    }
    for (const part of $$('#screen .part')) part.hidden = !$$('.cheat-sec, .sym-sec', part).some((s) => !s.hidden);
    $('#no-match').hidden = any;
  }

  // ---------- printed pages ----------

  const MAX_PAGES = 20;  // per part: a safety net against a runaway layout; past it the last page shrinks
  const CHEAT_COLS = 3;

  function page(root, part, ref, first, intro) {
    const label = el('span');
    const body = el('div', { class: 'ppage-body' },
      first ? el('h2', { class: 'ppage-title', text: intro.title }) : null,
      first && intro.subtitle ? el('p', { class: 'ppage-sub', text: intro.subtitle }) : null);
    root.append(el('section', { class: 'ppage', 'aria-label': part },
      el('header', { class: 'pbind' }, label, el('span', { class: 'pbind-ref', text: ref })),
      el('div', { class: 'ppage-inner' }, body)));
    return { body, label };
  }

  const label = (pages, part) => pages.forEach((p, i) => {
    p.label.textContent = `Chuleta REBT · ${part}${pages.length > 1 ? ` ${i + 1} de ${pages.length}` : ''} · ${builtDate}`;
  });

  // Chuleta and devices: sections fill three columns in order, column by column and page by page; a long section is
  // split between rows (at least two on each side) and continues in the next column.
  function layoutCheat(root, sheet = cheat, part = 'chuleta', ref = 'REBT · ITC-BT') {
    const pages = [];
    const newPage = () => {
      const p = page(root, part, ref, !pages.length, sheet);
      p.cols = Array.from({ length: CHEAT_COLS }, () => el('div', { class: 'cheat-col' }));
      p.body.append(el('div', { class: 'cheat-cols' }, p.cols));
      pages.push(p);
      return p;
    };
    const full = (col) => col.scrollHeight > col.clientHeight + 1;
    let p = newPage();
    let ci = 0;
    const advance = () => {
      if (ci + 1 < CHEAT_COLS) ci++;
      else if (pages.length < MAX_PAGES) { p = newPage(); ci = 0; }
      else return false;
      return true;
    };
    for (const s of sheet.sections) {
      let sec = cheatSection(s);
      for (;;) {
        const col = p.cols[ci];
        col.append(sec);
        if (!full(col)) break;
        const dl = sec.querySelector('.cheat-rows');
        const rest = [];
        while (dl && full(col) && dl.children.length > 2) { const r = dl.lastElementChild; r.remove(); rest.unshift(r); }
        if (dl && !full(col) && rest.length >= 2) {
          if (!advance()) { dl.append(...rest); break; }
          sec = cheatSection({ ...s, table: null, visuals: null, rows: [] }, `${s.title} (cont.)`);
          sec.append(el('dl', { class: 'cheat-rows' }, rest));
          continue;
        }
        if (dl) dl.append(...rest);
        if (col.children.length === 1) break;  // too tall even alone: shrink below
        sec.remove();
        if (!advance()) { p.cols[ci].append(sec); break; }
      }
    }
    for (let z = 1; p.cols.some(full) && z > 0.6; z -= 0.03) p.body.style.zoom = (z - 0.03).toFixed(2);
    label(pages, part);
    return pages.length;
  }

  // Symbols: sections flow down the page as tile grids; one that does not fit is split between rows of tiles and
  // continues on the next page. Sections of rows (if any) go two side by side at the end.
  function layoutSymbols(root) {
    const pages = [];
    const newPage = () => {
      const p = page(root, 'Símbolos', 'UNE-EN 60617', !pages.length, syms);
      p.flow = el('div', { class: 'psym-flow' });
      p.body.append(p.flow);
      pages.push(p);
      return p;
    };
    const full = (pg) => pg.flow.scrollHeight > pg.flow.clientHeight + 1;
    let p = newPage();
    const place = (block, split) => {
      for (;;) {
        p.flow.append(block);
        if (!full(p)) return;
        const rest = split ? split(block) : null;
        if (rest) block = rest;
        else if (p.flow.children.length === 1 || pages.length >= MAX_PAGES) return;  // shrink below
        else block.remove();
        if (pages.length >= MAX_PAGES) { p.flow.append(block); return; }
        p = newPage();
      }
    };
    // move trailing rows of tiles to a continuation section, keeping at least one row here
    const splitGrid = (s) => (sec) => {
      const grid = sec.querySelector('.sym-grid');
      const perRow = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
      const rest = [];
      while (full(p) && grid.children.length > perRow) {
        const n = grid.children.length % perRow || perRow;
        for (let k = 0; k < n; k++) { const t = grid.lastElementChild; t.remove(); rest.unshift(t); }
      }
      if (full(p) || !rest.length) { grid.append(...rest); return null; }
      return symbolSection(s, `${s.title} (cont.)`, rest);
    };
    for (const s of syms.sections.filter((x) => x.items)) place(symbolSection(s), splitGrid(s));
    const tables = syms.sections.filter((x) => x.rows);
    if (tables.length) place(el('div', { class: 'psym-tables' }, tables.map((s) => cheatSection(s))));
    if (syms.credit) p.flow.append(el('p', { class: 'sym-credit', text: syms.credit }));
    for (let z = 1; full(p) && z > 0.6; z -= 0.03) p.body.style.zoom = (z - 0.03).toFixed(2);
    label(pages, 'símbolos');
    return pages.length;
  }

  // ---------- print controls ----------

  const form = $('#print-form');
  const chosen = () => $$('input[name="part"]:checked', form).map((i) => i.value);
  const duplex = $('#duplex');
  let laidOut = null;  // the options the pages in #print-root were laid out for

  function layout() {
    const parts = chosen();
    const key = `${parts}|${duplex.checked}`;
    if (key === laidOut) return;
    const root = $('#print-root');
    root.replaceChildren();
    root.classList.toggle('duplex', duplex.checked);  // even pages (backs) carry the strip at the bottom
    const cp = parts.includes('chuleta') ? layoutCheat(root) : 0;
    const sp = parts.includes('simbolos') ? layoutSymbols(root) : 0;
    const dp = parts.includes('dispositivos') ? layoutCheat(root, devices, 'dispositivos', 'REBT · Guías técnicas') : 0;
    laidOut = key;
    const pages = cp + sp + dp;
    const sheets = duplex.checked ? Math.ceil(pages / 2) : pages;
    const what = [cp && `${cp} de chuleta`, sp && `${sp} de símbolos`, dp && `${dp} de dispositivos`].filter(Boolean).join(' + ');
    $('#print-est').textContent = pages ? `${pages} págs. → ${sheets} ${sheets === 1 ? 'hoja' : 'hojas'} A4` : 'Marca qué imprimir';
    $('#print-est').title = what;  // the breakdown per part, on hover
    $('#print').disabled = !pages;
    document.body.classList.toggle('duplex', duplex.checked);
  }

  function setPreview(on) {
    document.body.classList.toggle('preview', on);
    $('#preview').setAttribute('aria-pressed', on);
    $('#preview').textContent = on ? 'Volver' : 'Vista previa';
    $('#preview-note').hidden = !on;
    $('#print-root').setAttribute('aria-hidden', !on);
    window.scrollTo(0, 0);
  }

  async function boot() {
    renderScreen();
    const q = $('#q');
    q.addEventListener('input', () => search(q.value));
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !e.target.closest('input, textarea')) { e.preventDefault(); q.focus(); }
      if (e.key === 'Escape' && e.target === q && q.value) { q.value = ''; search(''); }
      if (e.key === 'Escape' && document.body.classList.contains('preview')) setPreview(false);
    });
    form.addEventListener('change', () => document.fonts.ready.then(layout));
    form.addEventListener('submit', (e) => { e.preventDefault(); layout(); window.print(); });
    $('#preview').addEventListener('click', () => { layout(); setPreview(!document.body.classList.contains('preview')); });
    window.addEventListener('beforeprint', layout);  // Ctrl+P before the fonts arrived: lay out with what there is
    // measure with the real fonts
    await Promise.allSettled(['400 16px Barlow', '600 16px Barlow', '600 16px "Barlow Condensed"', '700 16px "Barlow Condensed"']
      .map((f) => document.fonts.load(f)));
    await document.fonts.ready;
    laidOut = null;
    layout();
  }

  boot();
})();
