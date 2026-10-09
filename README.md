# Chuleta REBT

One page with five parts, each ready to print: the **chuleta** (acronyms, letters and the key figures of every
chapter of the Spanish low-voltage regulation, REBT, each tagged with its ITC-BT section), the **materials**
(materiales: cables, tubes, trunking, boxes, enclosures, sockets: how their codes are read), the **devices**
(dispositivos: fuses, ICP, IGA, surge protector, differential, PIA, emergency lights), the **measurements**
(mediciones: the instruments the REBT requires and how each verification is done), and the **UNE-EN 60617 graphical
symbols** a low-voltage electrician needs. Materials, devices and measurements come one section each, with a drawing.

Published at <https://guijealth.github.io/rebt-chuleta/>.

This is a study summary, not an official document: the text that counts is the
[REBT in the BOE](https://www.boe.es/biblioteca_juridica/codigos/codigo.php?id=326) (edition of 3 September 2025).

## Use

- **Read:** the page shows the five parts in that order. The search box (or the `/` key) filters them all: rows, table
  rows and symbols that contain every word, ignoring accents. A section whose title or reference matches stays whole.
- **Print:** **Imprimir…** in the top bar opens a dialog: tick what to print (**Chuleta**, **Materiales**,
  **Dispositivos**, **Mediciones**, **Símbolos**, **Doble cara**), see how many pages and sheets that is (per part), then **Imprimir**,
  or **Vista previa** to see the pages on screen (**Volver** in the bar returns). The browser's own Print
  (Ctrl/Cmd+P) gives the same result.
  - A4 landscape, a 14 mm blank strip at the top for binding (dashed edge line, part and page number, date).
  - The chuleta, materials, devices and measurements fill three columns. To save paper, when a section doesn't fit in what is left of a
    column, the biggest later section that fits is placed there (the order changes only to fill gaps); otherwise the
    section is split between rows and continues in the next column with "(cont.)", and a section whose drawing doesn't
    fit may start with its rows and continue with the drawing. The symbols flow down the page as tile grids, split
    between rows when they don't fit.
  - **Doble cara:** even pages carry the strip at the bottom. Print two-sided with "flip on long edge": both strips
    land on the same paper edge and every page reads upright when the sheet is flipped up.
  - In the print dialog leave margins on "Default" or "None"; the page sets A4 landscape and zero margins itself.

## Edit the content

Everything shown comes from five JSON files in `content/`. Edit them (on GitHub's web editor is fine): every push to
`main` rebuilds and republishes the page.

### `content/cheatsheet.json` — the chuleta

```json
{
 "title": "Chuleta REBT",
 "subtitle": "…",
 "sections": [
  {
   "title": "Baños y duchas",
   "ref": "ITC-BT-27 2.1",
   "rows": [
    ["Volumen 0", "interior de bañera o ducha · sin plato: hasta 0,05 m", "BT-27 2.1.1"]
   ]
  }
 ]
}
```

- Sections print in the order they are listed. Each row is `[what, value, ref]`, three strings.
- `ref` is where to check it: `"BT-19 2.2.4"` or `"art. 4"` (REBT, shown in blue), anything else such as
  `"Guía anexo 2"` (other documents, grey), or `""` when there is none. Several: `"BT-14 3 · BT-15 3"`. Check values
  against the text in `sources/` (see below); `python3 tools/sources.py check` confirms every ref points to a real
  section.
- **Formulas** go between `$…$` in a row's text (key or value) or a table cell, written in LaTeX and typeset by KaTeX:
  `"$e = \\dfrac{2 \\cdot P \\cdot L}{\\gamma \\cdot S \\cdot U}$ · U = 230 V"`. In JSON every backslash is doubled. Write a
  decimal comma as `{,}` (`1{,}45`), thousands with `\\,` (`5\\,750`), subscripts with `_` (`I_B`, `I_{\\Delta n}`),
  words with `\\text{…}`, "sen" with `\\operatorname{sen}`. Use `\\dfrac` for fractions so they stay readable when printed.
  `tools/build.py` rejects an unpaired `$`. Plain limits ("≥ 25 A") need no `$`.
- A section may have drawings, shown under its heading: `"visuals": ["pia"]` names `content/visuals/pia.svg`. They
  are our own SVGs, drawn with the `v-*` classes of `assets/chuleta.css` (`v-line`, `v-key`, `v-acc-soft`…) so they
  follow the light/dark theme and print in the paper palette; keep them 360 units wide, the width of a printed column.
- A section may also have a table, shown above its rows (or alone, with `"rows": []`):
  `"table": {"head": ["", "Uso", "PIA"], "rows": [["C1", "alumbrado", "10 A"]]}`. Every table row needs as many cells
  as `head`.

### `content/materials.json` — the materials

Same format as the chuleta: one section per material (tubes, trunking and trays, cables, boxes, IP/IK enclosures,
sockets and plugs), with a drawing where a code has to be read. Cables, tubes, boxes and accessories go here.

### `content/devices.json` — the devices

Same format as the chuleta: one section per device (`"PIA: interruptor automático (magnetotérmico)"`,
`"Diferencial: ID y AD"`…), usually with a drawing in `"visuals"`. A device or a piece of equipment goes here, not in
the chuleta. The drawings show what the device's data mean; they never claim how a standard says it is printed.

### `content/measurements.json` — the measurements

Same format: one section per instrument or test (earth tester, insulation tester, leakage clamp and voltage detector,
loop and RCD tester), plus the instruments ITC-BT-03 requires. Measuring and verification go here, not in devices.

### `content/calculators.json` — the calculators

Rows with a formula show a 🖩 button (screen only, never printed) that opens a form: type the values (decimal comma
or point), see the result as you type. Each calculator lists:

```json
{"id": "paralelo", "title": "Resistencias en paralelo", "tex": "\\dfrac{1}{R_{eq}} = …",
 "rows": [["Todas las fórmulas", "Resistencias en paralelo"], ["Todas las fórmulas", "Dos en paralelo"]],
 "inputs": [{"id": "R", "type": "list", "label": "Resistencias", "unit": "Ω", "min": 2}],
 "outputs": [{"label": "R_eq", "expr": "1 / sum(R.map(x => 1 / x))", "unit": "Ω", "digits": 3}],
 "example": {"R": [10, 10, 20]}}
```

- `rows`: the rows (section title and row key, exact) that get the button; the build fails if one doesn't exist.
- Inputs: a number (`unit`, `default`, `optional`, `hint`), `select` (`options` with `label` and `value`), `list`
  (several values of one variable: resistors, factors, motors) or `groups` (rows of several `fields`, e.g. groups of
  homes with their number and power).
- Outputs: `expr` is a JavaScript expression over the input ids and the helpers `sum`, `max`, `min`, `sqrt`, `PI`,
  `nextSection` (next standard section) and `coefSim` (ITC-BT-10 table 1). A blank optional input is `undefined`, so
  `V ?? R * I` solves for whichever value is missing. `{"type": "check", "expr": …, "ok": …, "fail": …}` shows ✓ or ✗.
- `constants` (standard sections, simultaneity coefficients) must equal the chuleta's own row and table: the build
  checks it. `example` fills the form (button «Ejemplo») and is what the tests run.
- `about` + `about_ref`: two or three sentences on what the formula is for, shown under it. Write them in our own
  words from the passage `about_ref` points to (checked like any ref). Basic electricity no official source explains
  (Ohm, series/parallel, energy…) gets a general text with `"about_general": true` instead, shown as «explicación
  general, no del REBT».

### `content/symbols.json` — the symbols

```json
{"qet": "07-13-05", "name": "Interruptor automático", "code": "Q", "note": "aspa = función interruptor automático"}
```

- `qet`: the symbol's EN 60617 number (part-section-symbol), which names its drawing in `content/elements/qet/`
  (`en_60617_07_13_05.elmt`); or a path under `content/elements/` for composite symbols (`qet/int_diff2.elmt`) and
  our corrections (`fixed/protective_earth.elmt`).
- `name` (required), `code` (reference letter, IEC 60750), `note` (one short line).
- `iec`: the number to show when it differs from `qet` (QElectroTech swaps 03-02-01 junction and 03-02-02 terminal).
- `star`: text that replaces the `*` of a general symbol: `"M"`, `"M\n3∼"` (motor), `"V"` (voltmeter)…
- `notext: true` drops the element's own captions (e.g. "Form 1").

The drawings are not hand-drawn: `tools/symbols.py` converts the QElectroTech elements to SVG without touching
their geometry. Known faults in that collection are corrected: the 03-02-01/02 swap (`iec`), and 02-15-03 protective
earth lacks its circle (`content/elements/fixed/`). To add a symbol whose element is not here yet, clone
[qelectrotech-elements](https://github.com/qelectrotech/qelectrotech-elements), add the symbol to `symbols.json`
and run `python3 tools/symbols.py --vendor <that checkout>` to copy its element.

### Check and preview locally

```
python3 tools/build.py       # checks the content (clear error with the section and row) and writes data.js
open index.html              # works straight from disk
```

`python3 tools/build.py --check` only checks. Python 3 standard library only. `data.js` is generated and not
committed: the workflow builds it.

## Sources

`sources/` keeps the official documents the content comes from, unchanged: the REBT (BOE), the Ministry's *Guía
Técnica de Aplicación del REBT*, RD 614/2001, the INSST electrical-risk guide and NTP 391, and the CTE DB-SUA. Each one
is there because its publisher allows redistribution; `sources/sources.json` records its URL, edition, checksum and
the publisher's terms, and `sources/README.md` explains them. Standards (UNE/IEC) and course material are never added.

```
python3 tools/sources.py grep "verde-amarillo"       # find the passage
python3 tools/sources.py show ITC-BT-19#2.2.4        # read the section
python3 tools/sources.py check                       # files unchanged, every ref resolves
python3 tools/sources.py update                      # anything new at the publishers?
```

Needs `pdftotext` (poppler). The workflow also runs `check` before publishing.

## Layout

| Path | What |
|---|---|
| `index.html`, `assets/chuleta.css`, `assets/chuleta.js` | The page: screen view, search, print layout and controls |
| `assets/fonts/` | Barlow and Barlow Condensed (woff2, Latin + Latin Extended) and their licence |
| `assets/katex/` | KaTeX script, stylesheet and woff2 fonts, for the formulas |
| `content/calculators.json` | The calculators behind the 🖩 buttons |
| `content/cheatsheet.json`, `materials.json`, `devices.json`, `measurements.json`, `symbols.json` | The content, in page order |
| `content/visuals/` | Our own SVG drawings for chuleta and device sections |
| `content/elements/qet/` | QElectroTech EN 60617 elements in use, with their licence (`ELEMENTS.LICENSE`) |
| `content/elements/fixed/` | Our corrections of faulty elements |
| `tools/build.py` | content → `data.js` (checks, SVG conversion) |
| `tools/symbols.py` | QElectroTech element → SVG; `--vendor` copies new elements |
| `sources/`, `sources/sources.json` | Official source documents, their origin and reuse terms |
| `tools/sources.py`, `tools/rebt_index.py` | Check, index, search and update the sources; REBT split into citable sections |
| `CLAUDE.md` | Working rules for editing this repo with Claude Code (what may be published, how to check) |
| `.github/workflows/pages.yml` | Builds and publishes to GitHub Pages on every push to `main` |

## Origin and credits

Extracted from a private study almanac (`rebt-almanac`), which keeps the same two JSON formats. Only this original
summary, the symbols and the freely redistributable official sources are published here.

- REBT: Real Decreto 842/2002 and its ITC-BT, as published by the BOE. Official legal texts are not subject to
  copyright (Ley de Propiedad Intelectual, art. 13); the chuleta is our own summary of their figures.
- Symbol drawings: the EN 60617 element collection of [QElectroTech](https://qelectrotech.org/), licensed
  [CC-BY 3.0](http://creativecommons.org/licenses/by/3.0/) (see `content/elements/qet/ELEMENTS.LICENSE`).
- Source documents: see `sources/README.md` for each publisher's terms and the attribution it asks for.
- Calculator icon: 🖩 from Noto Sans Symbols 2 (SIL OFL 1.1, `assets/fonts/OFL-NotoSansSymbols2.txt`), one glyph only.
- Formulas: [KaTeX](https://katex.org/) (MIT licence, `assets/katex/LICENSE`), served from this site.
- Fonts: Barlow and Barlow Condensed by the Barlow Project Authors, SIL Open Font License 1.1, served from this site
  (`assets/fonts/`, licence in `assets/fonts/OFL.txt`), so the page and its print layout work offline.
