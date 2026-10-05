# Chuleta REBT

One page with two parts, each ready to print: the **chuleta** (acronyms, letters and the key figures of every
chapter of the Spanish low-voltage regulation, REBT, each tagged with its ITC-BT section), followed by the
**UNE-EN 60617 graphical symbols** a low-voltage electrician needs.

Published at <https://guijealth.github.io/rebt-chuleta/>.

This is a study summary, not an official document: the text that counts is the
[REBT in the BOE](https://www.boe.es/biblioteca_juridica/codigos/codigo.php?id=326) (edition of 3 September 2025).

## Use

- **Read:** the page shows the chuleta, then the symbols. The search box (or the `/` key) filters both: rows, table
  rows and symbols that contain every word, ignoring accents. A section whose title or reference matches stays whole.
- **Print:** tick what to print (**Chuleta**, **Símbolos**, **Doble cara**) and press **Imprimir**, or use the browser's
  own Print (Ctrl/Cmd+P) for the same result. The bar shows how many pages and sheets that is. **Vista previa** shows
  the pages on screen.
  - A4 landscape, a 14 mm blank strip at the top for binding (dashed edge line, part and page number, date).
  - The chuleta fills three columns in order; a long section continues in the next column with "(cont.)". The
    symbols flow down the page as tile grids, split between rows when they don't fit.
  - **Doble cara:** even pages carry the strip at the bottom. Print two-sided with "flip on long edge": both strips
    land on the same paper edge and every page reads upright when the sheet is flipped up.
  - In the print dialog leave margins on "Default" or "None"; the page sets A4 landscape and zero margins itself.

## Edit the content

Everything shown comes from two JSON files in `content/`. Edit them (on GitHub's web editor is fine): every push to
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
- A section may also have a table, shown above its rows (or alone, with `"rows": []`):
  `"table": {"head": ["", "Uso", "PIA"], "rows": [["C1", "alumbrado", "10 A"]]}`. Every table row needs as many cells
  as `head`.

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
| `content/cheatsheet.json`, `content/symbols.json` | The content |
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
- Fonts: Barlow and Barlow Condensed (SIL Open Font License), from Google Fonts.
