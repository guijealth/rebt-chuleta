/* Chuleta REBT — one page in four parts (chuleta, materiales, dispositivos, símbolos), ready to print.
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
    for (const c of children.flat(Infinity)) if (c != null && c !== false) n.append(c);
    return n;
  };

  const data = window.CHULETA;
  if (!data) {
    $('#screen').textContent = 'Falta data.js: ejecuta «python3 tools/build.py».';
    return;
  }
  const builtDate = new Date(`${data.built}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

  // The parts of the page, in order. kind "sheet": sections of rows (and drawings); kind "symbols": tile grids.
  // id: anchor and print checkbox value · label: nav and checkbox · ref: right side of the printed binding strip.
  const PARTS = [
    { id: 'chuleta', label: 'Chuleta', data: data.cheatsheet, kind: 'sheet', ref: 'REBT · ITC-BT' },
    { id: 'materiales', label: 'Materiales', data: data.materials, kind: 'sheet', ref: 'REBT · Guías técnicas' },
    { id: 'dispositivos', label: 'Dispositivos', data: data.devices, kind: 'sheet', ref: 'REBT · Guías técnicas' },
    { id: 'simbolos', label: 'Símbolos', data: data.symbols, kind: 'symbols', ref: 'UNE-EN 60617' },
  ].filter((p) => p.data);
  const syms = data.symbols;

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
    for (const part of PARTS) {
      const d = part.data;
      $('#jump').append(el('a', { href: `#${part.id}`, text: part.label }));
      $('#part-checks').append(el('label', { class: 'check' },
        el('input', { type: 'checkbox', name: 'part', value: part.id, checked: '' }), ` ${part.label}`));
      $('#parts').append(el('section', { id: part.id, class: 'part', 'aria-labelledby': `${part.id}-title` },
        el('h2', { class: 'part-title', id: `${part.id}-title`, text: d.title }),
        d.subtitle ? el('p', { class: 'part-sub', text: d.subtitle }) : null,
        part.kind === 'sheet'
          ? el('div', { class: 'cheat-grid' }, d.sections.map((s) => cheatSection(s)))
          : [d.sections.map((s) => (s.items ? symbolSection(s) : cheatSection(s))),
            d.credit ? el('p', { class: 'sym-credit', text: d.credit }) : null]));
    }
    $('#foot').append(
      el('p', {}, 'Resumen para estudiar, ', el('strong', { text: 'no es un documento oficial' }),
        '. El texto que vale es el del ',
        el('a', { href: 'https://www.boe.es/biblioteca_juridica/codigos/codigo.php?id=326', text: 'REBT en el BOE' }),
        '; cada fila lleva su ITC-BT y apartado para comprobarlo.'),
      el('p', {}, syms?.credit ? `${syms.credit} ` : '', `Actualizado el ${builtDate}.`));
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

  const MAX_PAGES = 30;  // per part: a safety net against a runaway layout; past it the last page shrinks
  const CHEAT_COLS = 3;
  const LOOKAHEAD = 20;  // how many later sections may be tried to fill a gap

  function page(root, part, first) {
    const label = el('span');
    const body = el('div', { class: 'ppage-body' },
      first ? el('h2', { class: 'ppage-title', text: part.data.title }) : null,
      first && part.data.subtitle ? el('p', { class: 'ppage-sub', text: part.data.subtitle }) : null);
    root.append(el('section', { class: 'ppage', 'aria-label': part.label },
      el('header', { class: 'pbind' }, label, el('span', { class: 'pbind-ref', text: part.ref })),
      el('div', { class: 'ppage-inner' }, body)));
    return { body, label };
  }

  const label = (pages, part) => pages.forEach((p, i) => {
    p.label.textContent = `Chuleta REBT · ${part.label.toLowerCase()}${pages.length > 1 ? ` ${i + 1} de ${pages.length}` : ''} · ${builtDate}`;
  });

  // Sheets: sections fill three columns, column by column and page by page. To waste as little paper as possible:
  // when the next section does not fit in what is left of a column, the biggest later section that fits whole is
  // placed there instead (so the order changes only to fill gaps); when none fits, the next section is split between
  // rows (at least two on each side) and continues at the top of the next column.
  function layoutSheet(root, part) {
    const pages = [];
    const newPage = () => {
      const p = page(root, part, !pages.length);
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
    // queue of what is still to place: a section, or the continuation of a split one (which must go next)
    const queue = part.data.sections.map((s) => ({ s, node: null }));
    const nodeOf = (item) => (item.node ||= cheatSection(item.s));
    const fits = (col, node) => { col.append(node); const ok = !full(col); node.remove(); return ok; };
    while (queue.length) {
      const col = p.cols[ci];
      const first = queue[0];
      const sec = nodeOf(first);
      if (fits(col, sec)) { col.append(sec); queue.shift(); continue; }
      // fill the gap with the biggest later section that fits whole
      if (col.children.length && !first.cont) {
        let best = -1, bestH = 0;
        for (let k = 1; k < Math.min(queue.length, LOOKAHEAD + 1); k++) {
          const cand = nodeOf(queue[k]);
          if (!fits(col, cand)) continue;
          col.append(cand);
          const h = cand.getBoundingClientRect().height;
          cand.remove();
          if (h > bestH) { best = k; bestH = h; }
        }
        if (best > 0) { col.append(queue[best].node); queue.splice(best, 1); continue; }
      }
      // split: move trailing rows on, keeping at least two rows on each side
      col.append(sec);
      const dl = sec.querySelector('.cheat-rows');
      const rest = [];
      while (dl && full(col) && dl.children.length > 2) { const r = dl.lastElementChild; r.remove(); rest.unshift(r); }
      if (dl && !full(col) && rest.length === 1 && dl.children.length > 2) { const r = dl.lastElementChild; r.remove(); rest.unshift(r); }
      if (dl && !full(col) && rest.length >= 2) {
        const cont = cheatSection({ ...first.s, table: null, visuals: null, rows: [] }, `${first.s.title} (cont.)`);
        cont.append(el('dl', { class: 'cheat-rows' }, rest));
        queue[0] = { s: first.s, node: cont, cont: true };
        if (!advance()) break;
        continue;
      }
      if (dl) dl.append(...rest);
      sec.remove();
      // a section whose drawing does not fit in the gap may start there with its heading and first rows; the drawing
      // goes on, with the remaining rows, at the top of the next column
      if (!first.cont && first.s.visuals?.length && first.s.rows?.length > 2) {
        const head = cheatSection({ ...first.s, visuals: null });
        col.append(head);
        const hdl = head.querySelector('.cheat-rows');
        const tail = [];
        while (full(col) && hdl.children.length > 2) { const r = hdl.lastElementChild; r.remove(); tail.unshift(r); }
        if (!full(col)) {
          const cont = cheatSection({ ...first.s, table: null, rows: [] }, `${first.s.title} (cont.)`);
          if (tail.length) cont.append(el('dl', { class: 'cheat-rows' }, tail));
          queue[0] = { s: first.s, node: cont, cont: true };
          if (!advance()) break;
          continue;
        }
        head.remove();
      }
      if (!col.children.length) { col.append(sec); queue.shift(); if (!advance()) break; continue; }  // too tall even alone: shrink below
      if (!advance()) { p.cols[ci].append(sec); queue.shift(); break; }
    }
    for (const item of queue) p.cols[ci].append(nodeOf(item));  // only if MAX_PAGES was hit
    for (let z = 1; p.cols.some(full) && z > 0.6; z -= 0.03) p.body.style.zoom = (z - 0.03).toFixed(2);
    label(pages, part);
    return pages.length;
  }

  // Symbols: sections flow down the page as tile grids; one that does not fit is split between rows of tiles and
  // continues on the next page. Sections of rows (if any) go two side by side at the end.
  function layoutSymbols(root, part) {
    const d = part.data;
    const pages = [];
    const newPage = () => {
      const p = page(root, part, !pages.length);
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
    for (const s of d.sections.filter((x) => x.items)) place(symbolSection(s), splitGrid(s));
    const tables = d.sections.filter((x) => x.rows);
    if (tables.length) place(el('div', { class: 'psym-tables' }, tables.map((s) => cheatSection(s))));
    if (d.credit) p.flow.append(el('p', { class: 'sym-credit', text: d.credit }));
    for (let z = 1; full(p) && z > 0.6; z -= 0.03) p.body.style.zoom = (z - 0.03).toFixed(2);
    label(pages, part);
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
    const counts = PARTS.filter((part) => parts.includes(part.id))
      .map((part) => [part, part.kind === 'sheet' ? layoutSheet(root, part) : layoutSymbols(root, part)]);
    laidOut = key;
    const pages = counts.reduce((a, [, n]) => a + n, 0);
    const sheets = duplex.checked ? Math.ceil(pages / 2) : pages;
    $('#print-est').textContent = pages ? `${pages} págs. → ${sheets} ${sheets === 1 ? 'hoja' : 'hojas'} A4` : 'Marca qué imprimir';
    $('#print-parts').textContent = counts.map(([part, n]) => `${n} de ${part.label.toLowerCase()}`).join(' + ');
    $('#print').disabled = !pages;
    document.body.classList.toggle('duplex', duplex.checked);
  }

  function setPreview(on) {
    document.body.classList.toggle('preview', on);
    $('#preview').setAttribute('aria-pressed', on);
    $('#preview-back').hidden = !on;
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
    const dialog = $('#print-dialog');
    $('#print-open').addEventListener('click', () => { layout(); dialog.showModal(); });
    $('#print-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });  // click on the backdrop
    form.addEventListener('change', () => document.fonts.ready.then(layout));
    form.addEventListener('submit', (e) => { e.preventDefault(); layout(); dialog.close(); window.print(); });
    $('#preview').addEventListener('click', () => { layout(); dialog.close(); setPreview(true); });
    $('#preview-back').addEventListener('click', () => setPreview(false));
    window.addEventListener('beforeprint', layout);  // Ctrl+P before the fonts arrived: lay out with what there is
    // measure with the real fonts
    await Promise.allSettled(['400 16px Barlow', '500 16px Barlow', '600 16px Barlow', '500 16px "Barlow Condensed"',
      '600 16px "Barlow Condensed"', '700 16px "Barlow Condensed"']
      .map((f) => document.fonts.load(f)));
    await document.fonts.ready;
    laidOut = null;
    layout();
  }

  boot();
})();
