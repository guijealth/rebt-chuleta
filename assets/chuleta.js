/* Chuleta REBT — one page in five parts (chuleta, materiales, dispositivos, mediciones, símbolos), ready to print.
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

  const put = (target, ...children) => target.replaceChildren(...children.flat(Infinity).filter((c) => c != null && c !== false));

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
    { id: 'mediciones', label: 'Mediciones', data: data.measurements, kind: 'sheet', ref: 'REBT · Guía anexo 4' },
    { id: 'simbolos', label: 'Símbolos', data: data.symbols, kind: 'symbols', ref: 'UNE-EN 60617' },
  ].filter((p) => p.data);
  const syms = data.symbols;

  // ---------- building blocks, shared by the screen and the printed pages ----------

  // Text with formulas: what goes between $…$ is LaTeX, typeset by KaTeX (assets/katex/); the rest is plain text.
  // Without KaTeX (it failed to load), the formula is shown as written.
  function rich(text) {
    if (!text || !text.includes('$')) return text;
    return text.split(/\$([^$]+)\$/).map((part, i) => {
      if (i % 2 === 0) return part || null;
      if (!window.katex) return part;
      return el('span', { class: 'math', html: window.katex.renderToString(part, { throwOnError: false, output: 'htmlAndMathml' }) });
    });
  }
  // what search looks at: the visible text, without KaTeX's hidden MathML copy
  const findText = (node) => {
    const c = node.cloneNode(true);
    c.querySelectorAll('.katex-mathml').forEach((m) => m.remove());
    return c.textContent;
  };

  // Rows are [what, value, ref]; a ref from the REBT itself (BT-xx, art.) is blue, other documents grey.
  function cheatSection(s, title = s.title) {
    const kind = (r) => (!r ? null : /^(BT-|art\.)/.test(r) ? 'rebt' : 'official');
    return el('section', { class: 'cheat-sec' },
      el('h3', {}, title, el('span', { text: s.ref || '' })),
      (s.visuals || []).map((svg) => el('figure', { class: 'cheat-visual', html: svg })),
      s.table ? el('table', { class: 'cheat-table' },
        el('thead', {}, el('tr', {}, s.table.head.map((h) => el('th', {}, rich(h))))),
        el('tbody', {}, s.table.rows.map((r) => el('tr', {}, r.map((x) => el('td', {}, rich(x)))))) ) : null,
      s.rows?.length ? el('dl', { class: 'cheat-rows' }, s.rows.map(([k, v, r, calc]) => el('div', {},
        el('dt', {}, rich(k)), el('dd', {}, rich(v), calcButton(calc)),
        el('dd', { class: 'cheat-ref', 'data-kind': kind(r), text: r })))) : null);
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

  // ---------- calculators (content/calculators.json): a 🖩 button on a row opens a form for its formula ----------

  const CALCS = Object.fromEntries((data.calculators?.calculators || []).map((c) => [c.id, c]));
  const K = data.calculators?.constants || {};
  const HELPERS = {
    sum: (a) => a.reduce((x, y) => x + y, 0),
    max: Math.max,
    min: Math.min,
    sqrt: Math.sqrt,
    PI: Math.PI,
    nextSection: (S) => (K.secciones || []).find((x) => x >= S - 1e-9) ?? NaN,  // next standard section
    coefSim: (n) => (n < 1 ? NaN : n <= 21 ? K.coefSimultaneidad[Math.round(n) - 1] : 15.3 + (n - 21) * 0.5),  // ITC-BT-10 tabla 1
  };

  function calcButton(id) {
    if (!id || !CALCS[id]) return null;
    return el('button', { type: 'button', class: 'calc-btn', 'data-calc': id, title: `Calculadora: ${CALCS[id].title}`,
      'aria-label': `Calculadora: ${CALCS[id].title}` }, '\u{1F5A9}');
  }

  // "I_B" → I<sub>B</sub> in labels
  const subs = (text) => text.split(/([A-Za-zΔ])_([A-Za-zΔ0-9]+)/).map((part, i) =>
    (i % 3 === 2 ? el('sub', { text: part }) : part || null));

  // "1.234,5", "2,5", "2.5" → number; "" → undefined (a blank optional field); nonsense → NaN
  function parseNum(text) {
    let t = String(text).trim().replace(/\s/g, '');
    if (!t) return undefined;
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '');
    const v = Number(t.replace(',', '.'));
    return Number.isFinite(v) ? v : NaN;
  }
  // like the chuleta: decimal comma, thousands with a (non-breaking) space: 75 015,4
  const fmt = (v, digits = 2) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: digits, useGrouping: false }).format(v)
    .replace(/^(-?\d+)/, (m) => m.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0'));
  const showNum = (v) => (v == null ? '' : String(v).replace('.', ','));

  const compiled = new Map();
  function compile(calc, expr) {
    const key = `${calc.id}|${expr}`;
    if (!compiled.has(key)) {
      const names = calc.inputs.map((i) => i.id);
      compiled.set(key, new Function(...names, ...Object.keys(HELPERS), `"use strict"; return (${expr});`));
    }
    return compiled.get(key);
  }

  function numberField(attrs, value) {
    return el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', value: showNum(value), ...attrs });
  }

  function listRow(input, value) {
    const row = el('div', { class: 'calc-item' },
      numberField({ 'data-item': '' }, value),
      input.unit ? el('span', { class: 'calc-unit', text: input.unit }) : null,
      el('button', { type: 'button', class: 'calc-del', 'aria-label': 'Quitar', title: 'Quitar' }, '×'));
    return row;
  }
  function groupRow(input, value = {}) {
    return el('div', { class: 'calc-item calc-group' },
      input.fields.map((f) => el('label', {}, el('span', { class: 'calc-sub', text: f.label + (f.unit ? ` (${f.unit})` : '') }),
        numberField({ 'data-field': f.id }, value[f.id]))),
      el('button', { type: 'button', class: 'calc-del', 'aria-label': 'Quitar', title: 'Quitar' }, '×'));
  }

  function inputBlock(input) {
    const label = [subs(input.label), input.unit && input.type !== 'list' ? el('span', { class: 'calc-unit', text: ` (${input.unit})` }) : null,
      input.optional ? el('span', { class: 'calc-opt', text: ' opcional' }) : null];
    const hint = input.hint ? el('small', { class: 'calc-hint', text: input.hint }) : null;
    if (input.type === 'select') {
      return el('label', { class: 'calc-field' }, el('span', {}, label),
        el('select', { 'data-input': input.id }, input.options.map((o, i) => el('option', { value: i, text: o.label,
          selected: o.value === input.default ? '' : null }))), hint);
    }
    if (input.type === 'list' || input.type === 'groups') {
      const items = el('div', { class: 'calc-items' });
      const add = el('button', { type: 'button', class: 'btn btn-quiet calc-add' }, input.type === 'list' ? '+ Añadir valor' : '+ Añadir grupo');
      const box = el('fieldset', { class: 'calc-field calc-multi', 'data-input': input.id }, el('legend', {}, label), hint, items, add);
      const n = input.type === 'list' ? Math.max(input.min || 1, 2) : 1;
      for (let k = 0; k < n; k++) items.append(input.type === 'list' ? listRow(input) : groupRow(input));
      add.addEventListener('click', () => {
        const row = input.type === 'list' ? listRow(input) : groupRow(input);
        items.append(row);
        row.querySelector('input').focus();
      });
      return box;
    }
    return el('label', { class: 'calc-field' }, el('span', {}, label), numberField({ 'data-input': input.id }, input.default), hint);
  }

  // read the form: values by input id, and whether everything required is there and valid
  function readCalc(calc, form) {
    const values = {};
    let ok = true;
    for (const input of calc.inputs) {
      const node = form.querySelector(`[data-input="${input.id}"]`);
      if (input.type === 'select') { values[input.id] = input.options[node.value].value; continue; }
      if (input.type === 'list') {
        const nums = $$('input', node).map((x) => { const v = parseNum(x.value); x.classList.toggle('bad', Number.isNaN(v)); return v; });
        if (nums.some((v) => Number.isNaN(v))) ok = false;
        values[input.id] = nums.filter((v) => v !== undefined && !Number.isNaN(v));
        if (values[input.id].length < (input.min || 1)) ok = false;
        continue;
      }
      if (input.type === 'groups') {
        const groups = [];
        for (const row of $$('.calc-group', node)) {
          const g = {};
          let filled = 0, bad = false;
          for (const f of input.fields) {
            const x = row.querySelector(`[data-field="${f.id}"]`);
            const v = parseNum(x.value);
            x.classList.toggle('bad', Number.isNaN(v));
            if (Number.isNaN(v)) bad = true;
            if (v !== undefined) filled++;
            g[f.id] = v;
          }
          if (bad || (filled && filled < input.fields.length)) ok = false;
          else if (filled) groups.push(g);
        }
        values[input.id] = groups;
        if (!groups.length) ok = false;
        continue;
      }
      const v = parseNum(node.value);
      node.classList.toggle('bad', Number.isNaN(v));
      if (Number.isNaN(v) || (v === undefined && !input.optional)) ok = false;
      values[input.id] = v;
    }
    return { values, ok };
  }

  function runCalc(calc, values) {
    const args = [...calc.inputs.map((i) => values[i.id]), ...Object.values(HELPERS)];
    return calc.outputs.map((o) => {
      let v;
      try { v = compile(calc, o.expr)(...args); } catch { v = undefined; }
      return { o, v };
    });
  }

  function showResults(calc, form, out) {
    const { values, ok } = readCalc(calc, form);
    const res = ok ? runCalc(calc, values) : calc.outputs.map((o) => ({ o, v: undefined }));
    put(out, res.map(({ o, v }) => {
      let text, cls = '';
      if (o.type === 'check') {
        if (v === true) { text = `✓ ${o.ok}`; cls = 'pass'; } else if (v === false) { text = `✗ ${o.fail}`; cls = 'fail'; } else text = '—';
      } else text = typeof v === 'number' && Number.isFinite(v) ? `${fmt(v, o.digits ?? 2)}${o.unit ? ` ${o.unit}` : ''}` : '—';
      return el('div', { class: cls }, el('dt', {}, subs(o.label)), el('dd', { text }));
    }));
    out.previousElementSibling.hidden = ok;  // "faltan datos"
  }

  function fillCalc(calc, form, values) {
    for (const input of calc.inputs) {
      const node = form.querySelector(`[data-input="${input.id}"]`);
      const v = values[input.id];
      if (input.type === 'select') node.value = Math.max(0, input.options.findIndex((o) => o.value === (v ?? input.default)));
      else if (input.type === 'list' || input.type === 'groups') {
        const items = node.querySelector('.calc-items');
        const rows = v?.length ? v : [undefined, ...(input.type === 'list' ? [undefined] : [])];
        items.replaceChildren(...rows.map((x) => (input.type === 'list' ? listRow(input, x) : groupRow(input, x))));
      } else node.value = showNum(v ?? input.default);
    }
  }

  let calcDialog;
  function openCalc(id) {
    const calc = CALCS[id];
    if (!calc) return;
    if (!calcDialog) {
      calcDialog = el('dialog', { class: 'print-dialog calc-dialog', 'aria-labelledby': 'calc-title' });
      document.body.append(calcDialog);
      calcDialog.addEventListener('click', (e) => { if (e.target === calcDialog) calcDialog.close(); });
    }
    const form = el('form', { class: 'calc-form', novalidate: '' }, calc.inputs.map(inputBlock));
    const out = el('dl', { class: 'calc-out', 'aria-live': 'polite' });
    const missing = el('p', { class: 'calc-missing', text: 'Rellena los datos para ver el resultado.' });
    const update = () => showResults(calc, form, out);
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    form.addEventListener('click', (e) => {
      const del = e.target.closest('.calc-del');
      if (!del) return;
      const items = del.closest('.calc-items');
      if (items.children.length > 1) del.closest('.calc-item').remove();
      else del.closest('.calc-item').querySelectorAll('input').forEach((x) => { x.value = ''; });
      update();
    });
    form.addEventListener('submit', (e) => e.preventDefault());
    const example = el('button', { type: 'button', class: 'btn btn-quiet' }, 'Ejemplo');
    example.addEventListener('click', () => { fillCalc(calc, form, calc.example || {}); update(); });
    const clear = el('button', { type: 'button', class: 'btn btn-quiet' }, 'Borrar');
    clear.addEventListener('click', () => { fillCalc(calc, form, {}); update(); });
    const close = el('button', { class: 'btn-close', type: 'button', 'aria-label': 'Cerrar' }, '×');
    close.addEventListener('click', () => calcDialog.close());
    put(calcDialog, el('div', { class: 'print-panel calc-panel' },
      el('header', { class: 'print-head' }, el('h2', { id: 'calc-title' }, el('span', { class: 'calc-glyph', 'aria-hidden': 'true' }, '\u{1F5A9} '), calc.title), close),
      el('div', { class: 'calc-tex', html: window.katex ? window.katex.renderToString(calc.tex, { throwOnError: false, displayMode: true }) : calc.tex }),
      calc.note ? el('p', { class: 'calc-note', text: calc.note }) : null,
      form,
      el('section', { class: 'calc-result' }, el('h3', { text: 'Resultado' }), missing, out),
      el('div', { class: 'print-actions' }, example, clear)));
    update();
    calcDialog.showModal();
    form.querySelector('input, select')?.focus();
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.calc-btn');
    if (b) openCalc(b.dataset.calc);
  });
  window.chuletaCalc = { CALCS, readCalc, runCalc, fillCalc, openCalc };  // for the tests

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
        item.hidden = !whole && !hit(item.dataset.find ??= findText(item));
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
    p.label.textContent = `REBT · ${part.label.toLowerCase()}${pages.length > 1 ? ` ${i + 1} de ${pages.length}` : ''} · ${builtDate}`;
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
      '600 16px "Barlow Condensed"', '700 16px "Barlow Condensed"', '16px KaTeX_Main', 'italic 16px KaTeX_Math',
      '16px KaTeX_Size1', '16px KaTeX_Size2']
      .map((f) => document.fonts.load(f)));
    await document.fonts.ready;
    laidOut = null;
    layout();
  }

  boot();
})();
