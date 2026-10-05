"""Split the BOE "Reglamento electrotécnico para baja tensión e ITC" code into citable sections.

Input : sources/boe/rebt_boe_326.pdf (BOE Código electrónico nº 326)
Output: sources/index/rebt_index.json (generated, not committed; run by tools/sources.py index) -> {"source": {...}, "sections": [{id, document, number, title, pdf_page, book_page, text}]}

Every section id is stable for a given PDF edition, e.g. "ITC-BT-19#2.2.3" or "RD#art-16".
"""

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "sources" / "boe" / "rebt_boe_326.pdf"
OUT = ROOT / "sources" / "index" / "rebt_index.json"
BOE_URL = "https://www.boe.es/biblioteca_juridica/codigos/abrir_pdf.php?fich=326_Reglamento_electrotecnico_para_baja_tension_e_ITC.pdf"

FIRST_BODY_PAGE = 13  # "Artículo 1. Objeto." — everything before is cover, summary and preamble
HEADER_LINES = {"REGLAMENTO ELECTROTÉCNICO PARA BAJA TENSIÓN E ITC", "§ 2 Reglamento electrotécnico para baja tensión"}

ITC_RE = re.compile(r"^ITC-BT-(\d{2})$")
ARTICLE_RE = re.compile(r"^Artículo (\d+)\.\s+(.+)$")
HEADING_RE = re.compile(r"^(\d{1,2}(?:\.\d{1,2}){0,4})\.?\s+([A-ZÁÉÍÓÚÑ(«\"].{2,})$")
BOOK_PAGE_RE = re.compile(r"^–\s*(\d+)\s*–$")


def pdf_text_pages():
    txt = subprocess.run(["pdftotext", "-enc", "UTF-8", str(PDF), "-"], check=True, capture_output=True, text=True).stdout
    return txt.split("\f")


def pdf_edition(pages):
    m = re.search(r"Edición actualizada a (.+)", pages[0])
    return m.group(1).strip() if m else None


def itc_titles(pages):
    """Official ITC titles from the "Índice sistemático" (the body headings are scrambled by the PDF layout)."""
    toc = " ".join(pages[4:12])
    toc = re.sub(r"\s+", " ", toc)
    titles = {}
    parts = re.split(r"(ITC-BT-\d{2})\. ", toc)
    for code, chunk in zip(parts[1::2], parts[2::2]):
        # the title runs until the dot leaders (". . .") or the "– V –" page marker
        title = re.split(r"\s\.(?: \.)+|\s–", chunk)[0]
        titles.setdefault(code, title.strip(" ."))
    return titles


def is_glossary_term(line):
    """ITC-BT-01 terms are standalone upper-case lines, e.g. "TENSIÓN DE CONTACTO"."""
    letters = [c for c in line if c.isalpha()]
    return len(letters) >= 3 and not any(c.islower() for c in letters) and len(line) < 90 and not line.startswith("NOTA")


def is_successor(prev, new):
    """True when `new` is a plausible next heading number after `prev` (child, sibling or ancestor sibling)."""
    if prev is None:
        return new in ("0", "1")
    p = [int(x) for x in prev.split(".")]
    n = [int(x) for x in new.split(".")]
    if n == p + [1]:
        return True
    for depth in range(len(p), 0, -1):
        if n == p[: depth - 1] + [p[depth - 1] + 1]:
            return True
    return False


def build():
    pages = pdf_text_pages()
    sections = []
    cur = None
    doc = "RD"  # Real Decreto 842/2002 articles + Reglamento articles until ITC-BT-01
    prev_num = None
    in_itc_index = False
    pending_title_lines = 0

    def start(sec_id, document, number, title, pdf_page, book_page):
        nonlocal cur
        cur = {"id": sec_id, "document": document, "number": number, "title": title.strip(),
               "pdf_page": pdf_page, "book_page": book_page, "lines": []}
        sections.append(cur)

    for idx in range(FIRST_BODY_PAGE - 1, len(pages)):
        pdf_page = idx + 1
        lines = [l.strip() for l in pages[idx].splitlines()]
        book_page = next((int(m.group(1)) for l in lines if (m := BOOK_PAGE_RE.match(l))), None)
        for line in lines:
            if not line or line in HEADER_LINES or BOOK_PAGE_RE.match(line):
                continue
            if m := ITC_RE.match(line):
                doc = f"ITC-BT-{m.group(1)}"
                start(f"{doc}#0", doc, "0", "", pdf_page, book_page)
                prev_num, in_itc_index, pending_title_lines = None, False, 8
                continue
            if pending_title_lines and cur and cur["number"] == "0" and not HEADING_RE.match(line):
                # ITC title words come broken over several lines right after "ITC-BT-NN".
                cur["title"] = (cur["title"] + " " + line).strip()
                pending_title_lines -= 1
                continue
            pending_title_lines = 0
            if doc == "ITC-BT-01" and is_glossary_term(line):
                term = line.strip(" .:")
                start(f"ITC-BT-01#{term}", doc, term, term, pdf_page, book_page)
                cur["lines"].append(line)
                continue
            if doc == "ITC-BT-01":
                cur["lines"].append(line)
                continue
            if doc == "RD" and (m := ARTICLE_RE.match(line)):
                start(f"RD#art-{m.group(1)}", "Reglamento (RD 842/2002)", f"Artículo {m.group(1)}", m.group(2), pdf_page, book_page)
                cur["lines"].append(line)
                continue
            if doc != "RD" and (m := HEADING_RE.match(line)):
                num = m.group(1)
                if num == "0" and "ÍNDICE" in line.upper():
                    in_itc_index = True
                    cur["lines"].append(line)
                    continue
                if in_itc_index:
                    # The table of contents repeats headings; real text starts at the second "1."
                    if num == "1" and any(l.startswith("1") for l in cur["lines"][1:]):
                        in_itc_index = False
                    else:
                        cur["lines"].append(line)
                        continue
                # Top-level headings are written "1. TÍTULO"; "1 Red de distribución" is a figure legend.
                top_level_ok = "." in num or line.startswith(num + ".")
                if top_level_ok and is_successor(prev_num, num) and len(line) < 160:
                    start(f"{doc}#{num}", doc, num, m.group(2), pdf_page, book_page)
                    prev_num = num
                    cur["lines"].append(line)
                    continue
            if cur:
                cur["lines"].append(line)

    titles = itc_titles(pages)
    out = []
    for s in sections:
        s["document_title"] = titles.get(s["document"], "Reglamento electrotécnico para baja tensión (articulado)")
        if s["number"] == "0" and s["document"] in titles:
            s["title"] = titles[s["document"]]
        text = re.sub(r"\s+", " ", " ".join(s.pop("lines"))).strip()
        s["text"] = text
        s["pdf_url"] = f"{BOE_URL}#page={s['pdf_page']}"
        out.append(s)
    return {
        "source": {
            "title": "Reglamento electrotécnico para baja tensión e ITC (BOE, Códigos electrónicos nº 326)",
            "edition": pdf_edition(pages),
            "url": BOE_URL,
            "local_pdf": str(PDF.relative_to(ROOT)),
        },
        "sections": out,
    }


if __name__ == "__main__":
    index = build()
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    docs = {}
    for s in index["sections"]:
        docs[s["document"]] = docs.get(s["document"], 0) + 1
    print(f"{len(index['sections'])} sections from edition {index['source']['edition']} -> {OUT}", file=sys.stderr)
    for d, n in docs.items():
        print(f"  {d}: {n}", file=sys.stderr)
