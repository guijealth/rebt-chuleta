# Chuleta REBT — working notes

Public repo (`guijealth/rebt-chuleta`), published by GitHub Pages at https://guijealth.github.io/rebt-chuleta/ on every
push to `main` (`.github/workflows/pages.yml`). One static page in three printable parts: the chuleta, the UNE-EN 60617
symbols and the devices (dispositivos). User-facing text is Spanish; code, comments and docs are English. Read `README.md` (content formats) and
`sources/README.md` (sources and their terms) before changing things.

## Rule 1: everything must be allowed to be public

- Write content **from the documents in `sources/`**, in our own words: figures, limits, short definitions. Every row
  gets its ref (`"BT-19 2.2.4"`, `"art. 4"`, `"Guía anexo 2"`). Don't fill in from memory: find the passage with
  `python3 tools/sources.py grep …` and read it with `show` before writing the row.
- Don't paste long verbatim passages; short terms and figures are fine.
- **Never** add or quote: standards (UNE/EN/IEC/ISO, only cite their numbers), course material (MasterD) or anything
  from the private `../rebt-almanac` that came from it (its questions, tests, `refs/masterd/`), textbooks, commercial sites.
- Standards themselves are not in `sources/`: write about a standard only what the official documents say about it
  (the Guías cite them often). Device marking formats (how a PIA or a differential is labelled) are defined only in
  the standards: the user chose to show the data and its meaning, never a claimed printed format.
- Symbol drawings only from QElectroTech's EN 60617 collection (CC-BY 3.0; keep the credit) or our own drawings.
- **New source document:** only from an official publisher (BOE, ministries, INSST, CTE, EU Official Journal…).
  First read the publisher's legal notice / reuse terms on its site and record them in `sources/sources.json`
  `publishers` (terms URL, licence, what it allows, attribution text) and in the table of `sources/README.md`. Then
  `python3 tools/sources.py add …`. If the terms don't allow redistribution, don't add the file: cite its URL only.
  If the terms are unclear, ask the user.

## Rule 2: check before pushing

```
python3 tools/build.py            # content checks + data.js
python3 tools/sources.py check    # sources unchanged + every chuleta ref resolves to a real section
open index.html                   # works from disk
```

For layout or print changes, render with headless Chrome and look at the pages:

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-pdf-header-footer \
  --virtual-time-budget=8000 --print-to-pdf=<scratch>/out.pdf "file://$PWD/index.html"
pdftoppm -r 60 -png -f 1 -l 2 <scratch>/out.pdf <scratch>/p      # then view the PNGs
```

Screens: `--screenshot --window-size=1400,900`. Phone width: headless can't go below ~500 px, so load the page in a
390 px iframe from a scratch HTML file (`--allow-file-access-from-files`). The bar shows the page count: compare it
before and after a change (now 13 chuleta + 4 material + 5 device + 3 measurement + 4 symbol pages).

Commit and push when the user asks; the push publishes. The workflow runs `tools/build.py`; check the run with
`gh run list` / `gh run watch`.

## Where things are

- `content/cheatsheet.json`: sections → `rows` `[what, value, ref]`, optional `table {head, rows}`. Order = page order.
- `content/materials.json`: one section per material (cables, tubes, trunking, boxes, IP/IK enclosures, sockets), same
  format. **Materials go here, devices in devices.json, rules and figures in the chuleta** (user's request, 2026-10-09).
- `content/devices.json`: one section per device (fuses, ICP, IGA, surge protector, differential, PIA, emergency
  lights), same format. **A device or piece of equipment goes here, not in the chuleta.**
- `content/measurements.json`: measuring instruments and verification tests, same format. **Measuring goes here, not
  in devices** (user's request, 2026-10-09).
- Formulas: LaTeX between `$…$` in rows and table cells (KaTeX, `assets/katex/`); see README for the conventions
  (`{,}` decimal comma, `\dfrac`, `\operatorname{sen}`). Check new ones render: count `.katex-error` in a headless page.
- `content/visuals/*.svg`: our own drawings for chuleta, material, device and measurement sections (`"visuals": [name]`); 360 units wide, `v-*` classes.
- `content/symbols.json`: sections → `items` `{qet, name, code?, note?, iec?, star?, notext?}`. New element:
  `python3 tools/symbols.py --vendor <qelectrotech-elements checkout>` (clone github.com/qelectrotech/qelectrotech-elements).
- `assets/chuleta.js`: screen rendering, search, and the print layout (pages pre-built in `#print-root`, hidden on
  screen). `PARTS` lists the parts in page order: chuleta, materiales, dispositivos, mediciones, símbolos (nav, checkboxes,
  screen and print all come from it). `layoutSheet` packs sections into 3 columns: biggest later section that fits
  fills a gap, else split by rows (≥ 2 each side), else a section may start with its rows and continue with its
  drawing. `layoutSymbols` splits tile grids between rows. To check print waste, measure each `.cheat-col`'s used
  height against its clientHeight in a headless page.
  `assets/chuleta.css`: screen styles, then `.ppage` print styles (A4 landscape, 14 mm binding strip, duplex).
- `sources/`: official PDFs + `sources.json`. `tools/sources.py` (check, index, grep, show, sections, update, add);
  `tools/rebt_index.py` splits the REBT into sections (`ITC-BT-19#2.2.4`, `RD#art-16`).

## Keeping sources current

`python3 tools/sources.py update` re-downloads every document and reports changes (NTP 391 must be checked by hand:
the INSST serves it only through a viewer page). With `--write` it replaces the files and updates `sources.json`;
then run `check`, fix refs that moved, and review figures in the affected ITCs.

## Relation to rebt-almanac

`../rebt-almanac` (private, holds copyrighted course material) uses the same JSON formats for the chuleta
(`data/study/cheatsheet.json`) and symbols (`data/study/symbols.json`). Content may flow between them, but before
copying anything into this repo check it against Rule 1: remove references to the course or its tests.
