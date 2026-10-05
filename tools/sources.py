"""The official documents in sources/: check, index, search, read, update and add.

    python3 tools/sources.py check              # files match sources.json; every chuleta ref points somewhere real
    python3 tools/sources.py index              # (re)builds sources/index/ (text of every document; not committed)
    python3 tools/sources.py grep "0,25 m" [-d ITC-BT-16] [-w 120] [-n 12]
    python3 tools/sources.py show ITC-BT-19#2.2.4        # full text of a REBT section
    python3 tools/sources.py show GUIA-BT-ANEXO-2 5      # text of page 5 of another document
    python3 tools/sources.py sections ITC-BT-25          # the section ids of one ITC (or "RD", or "" for all)
    python3 tools/sources.py update [--write]            # downloads every document again and reports what changed
    python3 tools/sources.py add ID URL --publisher KEY --title "…" [--dir boe] [--edition "…"]

Needs pdftotext (poppler: `brew install poppler` / `apt install poppler-utils`); otherwise standard library only.

Search ids: the REBT is split into sections ("ITC-BT-19#2.2.4", "RD#art-16", "ITC-BT-01#TENSIÓN DE CONTACTO"),
the other documents into pages (their sources.json id, e.g. GUIA-BT-ANEXO-2, INSST-NTP-391). -d filters by id prefix.

Adding a document: its publisher must already be in sources.json "publishers", with the reuse terms checked on the
publisher's site (see CLAUDE.md). `add` refuses otherwise.
"""

import argparse
import datetime
import hashlib
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import rebt_index  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "sources"
MANIFEST = SRC / "sources.json"
INDEX = SRC / "index"
PAGES = INDEX / "pages.json"
CHEAT = ROOT / "content" / "cheatsheet.json"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"


def manifest():
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def save_manifest(m):
    MANIFEST.write_text(json.dumps(m, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def pdf_pages(path):
    txt = subprocess.run(["pdftotext", "-enc", "UTF-8", str(path), "-"], check=True, capture_output=True, text=True).stdout
    return [re.sub(r"[ \t]+", " ", p).strip() for p in txt.split("\f")]


# ---------- index ----------

def build_index():
    INDEX.mkdir(exist_ok=True)
    idx = rebt_index.build()
    rebt_index.OUT.write_text(json.dumps(idx, ensure_ascii=False, indent=1), encoding="utf-8")
    m = manifest()
    pages = {k: pdf_pages(ROOT / d["file"]) for k, d in m["docs"].items() if k != "REBT"}
    PAGES.write_text(json.dumps(pages, ensure_ascii=False), encoding="utf-8")
    print(f"REBT: {len(idx['sections'])} sections (edition {idx['source']['edition']}) · "
          f"{len(pages)} other documents, {sum(map(len, pages.values()))} pages → {INDEX.relative_to(ROOT)}/")


def stale():
    """True when the index is missing or older than a document or the indexer."""
    if not (rebt_index.OUT.exists() and PAGES.exists()):
        return True
    built = min(rebt_index.OUT.stat().st_mtime, PAGES.stat().st_mtime)
    inputs = [MANIFEST, Path(rebt_index.__file__)] + [ROOT / d["file"] for d in manifest()["docs"].values()]
    return any(p.stat().st_mtime > built for p in inputs)


def load_index():
    if stale():
        print("(building the index first)", file=sys.stderr)
        build_index()
    return json.loads(rebt_index.OUT.read_text(encoding="utf-8"))["sections"], json.loads(PAGES.read_text(encoding="utf-8"))


# ---------- search and read ----------

def grep(a):
    sections, pages = load_index()
    hits = 0
    units = [(s["id"], f"p{s['pdf_page']}", s["text"]) for s in sections]
    units += [(k, f"p{i}", re.sub(r"\s+", " ", t)) for k, doc in pages.items() for i, t in enumerate(doc, 1)]
    for uid, where, text in units:
        if not uid.startswith(a.d):
            continue
        for mt in re.finditer(a.pattern, text, re.I):
            print(f"{uid} {where}: …{text[max(0, mt.start() - a.w): mt.end() + a.w]}…")
            hits += 1
            if hits >= a.n:
                return
    if not hits:
        print("no matches", file=sys.stderr)


def show(a):
    sections, pages = load_index()
    if a.page is None:
        s = next((s for s in sections if s["id"] == a.id), None)
        if not s:
            raise SystemExit(f"no section {a.id}; list them with: python3 tools/sources.py sections {a.id.split('#')[0]}")
        print(f"{s['id']} — {s['title']} ({s['document_title']}) · PDF p{s['pdf_page']} · {s['pdf_url']}\n\n{s['text']}")
    else:
        doc = pages.get(a.id) or (_ for _ in ()).throw(SystemExit(f"no document {a.id} (ids are in sources/sources.json)"))
        print(f"{a.id} p{a.page} of {len(doc)} · {manifest()['docs'][a.id]['url']}#page={a.page}\n\n{doc[a.page - 1]}")


def list_sections(a):
    sections, _ = load_index()
    for s in sections:
        if s["id"].startswith(a.prefix):
            print(f"{s['id']:34} p{s['pdf_page']:<4} {s['title'][:90]}")


# ---------- check ----------

REF_PART = re.compile(r"^(?:BT-(?P<itc>\d{2})(?:\s+(?:(?P<tabla>tabla\s+\d+)|(?P<num>\d+(?:\.\d+)*)(?:-[\d.]+)?))?"
                      r"|art\.\s*(?P<art>\d+)|Guía(?:\s+(?P<guia>.+))?)$")


def check_refs(sections, docs):
    """Each row ref of the chuleta ("BT-19 2.2.4 · BT-15 3", "art. 4", "Guía anexo 2") must point to a real place."""
    ids = {s["id"] for s in sections}
    bad = []
    for sec in json.loads(CHEAT.read_text(encoding="utf-8"))["sections"]:
        for row in sec.get("rows", []):
            ref = row[2]
            for part in filter(None, (p.strip() for p in ref.split("·"))):
                m = REF_PART.match(part)
                ok = bool(m)
                if m and m["itc"]:
                    doc = f"ITC-BT-{m['itc']}"
                    ok = f"{doc}#0" in ids
                    if ok and m["num"]:
                        ok = f"{doc}#{m['num']}" in ids
                elif m and m["art"]:
                    ok = f"RD#art-{m['art']}" in ids
                elif m and m["guia"]:
                    g = re.match(r"anexo\s+(\d)$", m["guia"])
                    ok = bool(g) and f"GUIA-BT-ANEXO-{g[1]}" in docs
                if not ok:
                    bad.append(f"  {sec['title']} · {row[0]}: «{part}»")
    return bad


def check(a):
    m = manifest()
    errors = []
    listed = {Path(d["file"]) for d in m["docs"].values()}
    for k, d in m["docs"].items():
        p = ROOT / d["file"]
        if d["publisher"] not in m["publishers"]:
            errors.append(f"{k}: publisher {d['publisher']} has no reuse terms in sources.json")
        if not p.is_file():
            errors.append(f"{k}: missing file {d['file']}")
        elif sha256(p) != d["sha256"]:
            errors.append(f"{k}: {d['file']} differs from sources.json (sha256); if it is a new edition, record it with `update --write`")
    for p in SRC.rglob("*"):
        if p.is_file() and p.suffix.lower() == ".pdf" and p.relative_to(ROOT) not in listed:
            errors.append(f"{p.relative_to(ROOT)}: not in sources.json (every file needs its source and reuse terms)")
    sections, pages = load_index()
    bad = check_refs(sections, set(pages))
    print(f"{len(m['docs'])} documents checked" + ("" if errors else ", all match sources.json"))
    if bad:
        print(f"{len(bad)} chuleta refs that don't match a REBT section id (check them with `sections`/`show`; "
              f"the indexer misses some headings, so a miss is not always wrong):\n" + "\n".join(bad))
    else:
        print("every chuleta ref points to a real section")
    if errors:
        raise SystemExit("\n".join(errors))


# ---------- update and add ----------

def download(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "es"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def edition_of(data):
    tmp = INDEX / "_probe.pdf"
    INDEX.mkdir(exist_ok=True)
    tmp.write_bytes(data)
    try:
        first = pdf_pages(tmp)[0]
    finally:
        tmp.unlink()
    m = re.search(r"Edici[oó]n(?: actualizada a)?:?\s*([^\n]+?)\s*(?:Revisi[oó]n|\n|$)", first)
    return m[1] if m else None


def update(a):
    m = manifest()
    today = datetime.date.today().isoformat()
    changed = 0
    for k, d in m["docs"].items():
        if a.only and not k.startswith(a.only):
            continue
        if d.get("manual"):
            print(f"{k}: check by hand ({d.get('note', d['url'])})")
            continue
        try:
            data = download(d["url"])
        except Exception as e:  # noqa: BLE001 — report and go on with the rest
            print(f"{k}: could not download ({e}); check {d['url']}")
            continue
        if not data.startswith(b"%PDF"):
            print(f"{k}: the URL did not return a PDF; the publisher may have moved it: {d['url']}")
            continue
        new = hashlib.sha256(data).hexdigest()
        if new == d["sha256"]:
            print(f"{k}: unchanged")
            continue
        changed += 1
        ed = edition_of(data)
        print(f"{k}: CHANGED ({d['bytes']} → {len(data)} bytes; edition {d.get('edition')} → {ed})")
        if a.write:
            (ROOT / d["file"]).write_bytes(data)
            d.update(sha256=new, bytes=len(data), retrieved=today, edition=ed or d.get("edition"))
    if a.write and changed:
        save_manifest(m)
        print("sources.json updated; now: python3 tools/sources.py check (refs may have moved in a new edition)")
    elif changed:
        print("run again with --write to replace the files")


def add(a):
    m = manifest()
    if a.publisher not in m["publishers"]:
        raise SystemExit(f"unknown publisher {a.publisher}: first check its reuse terms and add them to sources.json "
                         f"'publishers' (known: {', '.join(m['publishers'])})")
    if a.id in m["docs"]:
        raise SystemExit(f"{a.id} already exists; use update")
    data = download(a.url)
    if not data.startswith(b"%PDF"):
        raise SystemExit("the URL did not return a PDF")
    name = a.name or re.sub(r"[^\w.-]+", "_", Path(urllib.request.url2pathname(a.url.split("?")[0])).name)
    if not name.lower().endswith(".pdf"):
        name += ".pdf"
    path = SRC / a.dir / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    m["docs"][a.id] = {"title": a.title, "publisher": a.publisher, "file": str(path.relative_to(ROOT)), "url": a.url,
                       "edition": a.edition or edition_of(data), "sha256": hashlib.sha256(data).hexdigest(),
                       "bytes": len(data), "retrieved": datetime.date.today().isoformat()}
    save_manifest(m)
    print(f"added {a.id}: {path.relative_to(ROOT)} ({len(data) // 1024} KB); rebuild the index: python3 tools/sources.py index")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("check").set_defaults(fn=check)
    sub.add_parser("index").set_defaults(fn=lambda a: build_index())
    g = sub.add_parser("grep")
    g.add_argument("pattern")
    g.add_argument("-d", default="", help="id prefix filter (ITC-BT-19, RD, GUIA-BT-ANEXO-2, INSST…)")
    g.add_argument("-w", type=int, default=110, help="context chars each side")
    g.add_argument("-n", type=int, default=12, help="max hits")
    g.set_defaults(fn=grep)
    s = sub.add_parser("show")
    s.add_argument("id")
    s.add_argument("page", nargs="?", type=int)
    s.set_defaults(fn=show)
    ls = sub.add_parser("sections")
    ls.add_argument("prefix", nargs="?", default="")
    ls.set_defaults(fn=list_sections)
    u = sub.add_parser("update")
    u.add_argument("--write", action="store_true")
    u.add_argument("--only", default="", help="id prefix")
    u.set_defaults(fn=update)
    ad = sub.add_parser("add")
    ad.add_argument("id")
    ad.add_argument("url")
    ad.add_argument("--publisher", required=True)
    ad.add_argument("--title", required=True)
    ad.add_argument("--dir", required=True, help="folder under sources/ (boe, insst, ministerio-industria/…)")
    ad.add_argument("--name", help="file name (default: from the URL)")
    ad.add_argument("--edition")
    ad.set_defaults(fn=add)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
