# Sources

Official documents the content is written from and checked against. They are kept here, unchanged, so every figure
in the chuleta can be traced to its text without relying on memory or on websites that move.

`sources.json` lists every file: id, title, publisher, original URL, edition, SHA-256, size and the date it was
downloaded. It also lists each publisher's reuse terms and the attribution it asks for. `tools/sources.py check`
fails if a file is missing, has changed, or is not listed.

## What is here and why it may be

| Folder | Documents | Publisher's terms | Attribution |
|---|---|---|---|
| `boe/rebt_boe_326.pdf` | REBT and its ITC-BT, BOE *Códigos electrónicos* nº 326, edition of 3 September 2025 | **CC BY-NC-ND 4.0**, stated in the PDF: redistribution unchanged, non-commercial, with attribution. The legal text itself is not subject to copyright (Ley de Propiedad Intelectual, art. 13). | Fuente: Agencia Estatal Boletín Oficial del Estado ([boe.es](https://www.boe.es)), Códigos electrónicos, CC BY-NC-ND 4.0 |
| `boe/RD_614_2001_riesgo_electrico.pdf` | RD 614/2001 (electrical risk at work), consolidated text | [BOE legal notice](https://www.boe.es/informacion/aviso_legal/index.php): reuse allowed, commercial or not, citing the source and without distorting it; consolidated texts are informative only | Fuente de los datos: Agencia Estatal Boletín Oficial del Estado ([boe.es](https://www.boe.es)) |
| `ministerio-industria/guia-tecnica-rebt/` | *Guía Técnica de Aplicación del REBT*: all 37 files the Ministry publishes (introduction, index, general aspects, the ITC guides, annexes 1–4, the note on galvanic separation) | [Ministry legal notice](https://sede.serviciosmin.gob.es/es-es/paginas/aviso.aspx): reproduction is prohibited only «sin citar su origen o solicitar autorización», so it is allowed citing the origin; public sector information (Ley 37/2007) | Fuente: Ministerio de Industria y Turismo, Guía Técnica de Aplicación del Reglamento Electrotécnico para Baja Tensión ([industria.gob.es](https://industria.gob.es)) |
| `insst/` | INSST technical guide on electrical risk (RD 614/2001), July 2020; NTP 391 (hand tools) | [INSST legal notice](https://www.insst.es/informacion-general/aviso-legal): reuse allowed, commercial or not, including adaptation, citing the source, keeping update dates, without distorting or implying endorsement | Origen de los datos: Instituto Nacional de Seguridad y Salud en el Trabajo ([insst.es](https://www.insst.es)) |
| `cte/CTE_DB-SUA_comentado.pdf` | CTE *Documento Básico SUA* with the Ministry's comments | The DB is a regulation (RD 314/2006, published in the BOE). codigotecnico.org has no separate legal notice; its documents state «Se permite la reproducción total o parcial del contenido de este documento siempre y cuando se cite la fuente original y a sus autores». | Fuente: Ministerio de Vivienda y Agenda Urbana, Código Técnico de la Edificación ([codigotecnico.org](https://www.codigotecnico.org)) |

Terms checked on the publishers' websites on 6 October 2026. These files are in the repository only: the published
page (GitHub Pages) carries just the chuleta and the symbols, not these PDFs.

## What is never added

- **Standards** (UNE, EN, IEC, ISO): sold by UNE/IEC and copyrighted. Cite them by number only. The symbol drawings
  come from QElectroTech's CC-BY collection (`content/elements/`), not from the standard.
- **Course material, textbooks, test banks** (e.g. MasterD), and commercial websites or manufacturers' catalogues.
- Anything whose publisher's terms have not been checked and written in `sources.json`.

## Tools

```
python3 tools/sources.py check                      # files and chuleta refs
python3 tools/sources.py grep "0,25 m" -d ITC-BT-07   # search (regex, case-insensitive)
python3 tools/sources.py show ITC-BT-19#2.2.4         # one REBT section in full
python3 tools/sources.py show GUIA-BT-ANEXO-2 5       # one page of another document
python3 tools/sources.py sections ITC-BT-25           # section ids of an ITC
python3 tools/sources.py update [--write]             # compare with the publishers' current files
python3 tools/sources.py add ID URL --publisher KEY --dir FOLDER --title "…"
```

The index (`sources/index/`, plain text of every document) is generated on first use and not committed. It needs
`pdftotext` (poppler).

**New REBT edition:** `python3 tools/sources.py update --write --only REBT`, then `check`: references whose section
moved or disappeared are listed.
