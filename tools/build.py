"""Build data.js, the data the page reads, from the content files:

    content/cheatsheet.json   the chuleta (sections of [what, value, ref] rows, optional table)
    content/materials.json    the materials (cables, tubes, enclosures, sockets…), same format as the chuleta
    content/devices.json      the devices (PIA, differential…), same format as the chuleta
    content/measurements.json the measuring instruments and tests, same format as the chuleta
    content/symbols.json      the symbol sheet (sections of UNE-EN 60617 symbols)
    content/elements/         the symbol drawings (QElectroTech EN 60617 elements, converted to SVG here)
    content/visuals/          our own SVG drawings, shown in a chuleta section that lists them in "visuals"

    python3 tools/build.py            # checks the content and writes data.js
    python3 tools/build.py --check    # only checks

Standard library only. The GitHub Pages workflow runs it on every push, so data.js is never committed.
"""

import datetime
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from symbols import element_file, to_svg  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
OUT = ROOT / "data.js"
VISUALS = CONTENT / "visuals"


def load(name):
    path = CONTENT / name
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise SystemExit(f"{path.relative_to(ROOT)}: line {e.lineno}, column {e.colno}: {e.msg}")


def check_cheatsheet(c, name="cheatsheet.json"):
    errors = []
    for i, s in enumerate(c.get("sections", []), 1):
        where = f"{name}, section {i} ({s.get('title', 'no title')})"
        if not s.get("title"):
            errors.append(f"{where}: missing title")
        for k, row in enumerate(s.get("rows", []), 1):
            if not (isinstance(row, list) and len(row) == 3 and all(isinstance(x, str) for x in row)):
                errors.append(f"{where}, row {k}: must be [what, value, ref] (three strings; ref may be \"\")")
            elif any(x.count("$") % 2 for x in row[:2]):
                errors.append(f"{where}, row {k}: unpaired $ (formulas go between $…$)")
        t = s.get("table")
        if t:
            for k, row in enumerate(t.get("rows", []), 1):
                if len(row) != len(t.get("head", [])):
                    errors.append(f"{where}, table row {k}: {len(row)} cells but {len(t['head'])} headings")
        if not s.get("rows") and not t:
            errors.append(f"{where}: no rows and no table")
        for name in s.get("visuals", []):
            svg = VISUALS / f"{name}.svg"
            if not svg.is_file():
                errors.append(f"{where}: visual '{name}' not found ({svg.relative_to(ROOT)})")
                continue
            try:
                ET.parse(svg)
            except ET.ParseError as e:
                errors.append(f"{svg.relative_to(ROOT)}: not valid SVG/XML ({e})")
    return errors


def check_symbols(c):
    errors = []
    for i, s in enumerate(c.get("sections", []), 1):
        where = f"symbols.json, section {i} ({s.get('title', 'no title')})"
        for k, it in enumerate(s.get("items", []), 1):
            if not it.get("name") or not it.get("qet"):
                errors.append(f"{where}, symbol {k}: needs 'name' and 'qet'")
            elif not element_file(it["qet"]).is_file():
                errors.append(f"{where}, symbol {k} ({it['name']}): no element file for '{it['qet']}' "
                              f"(add it with: python3 tools/symbols.py --vendor <qelectrotech-elements checkout>)")
        if s.get("rows"):
            errors += check_cheatsheet({"sections": [s]}, "symbols.json")
    return errors


def main():
    cheat, materials, devices, measurements, syms = (load(f) for f in (
        "cheatsheet.json", "materials.json", "devices.json", "measurements.json", "symbols.json"))
    errors = (check_cheatsheet(cheat) + check_cheatsheet(materials, "materials.json") + check_cheatsheet(devices, "devices.json")
              + check_cheatsheet(measurements, "measurements.json") + check_symbols(syms))
    if errors:
        raise SystemExit("\n".join(errors))
    rows = lambda c: sum(len(s.get("rows", [])) + len(s.get("table", {}).get("rows", [])) for s in c["sections"])
    n_syms = sum(len(s.get("items", [])) for s in syms["sections"])
    print(f"content ok: chuleta {len(cheat['sections'])} sections, {rows(cheat)} rows · "
          f"materials {len(materials['sections'])} sections, {rows(materials)} rows · "
          f"devices {len(devices['sections'])} sections, {rows(devices)} rows · "
          f"measurements {len(measurements['sections'])} sections, {rows(measurements)} rows · {n_syms} symbols")
    if "--check" in sys.argv:
        return
    for c in (cheat, materials, devices, measurements, syms):
        c.pop("_doc", None)
    for s in cheat["sections"] + materials["sections"] + devices["sections"] + measurements["sections"]:
        if s.get("visuals"):  # inline SVG, without the XML prolog or comments
            s["visuals"] = [re.sub(r"<\?xml[^>]*>|<!--.*?-->", "", (VISUALS / f"{n}.svg").read_text(encoding="utf-8"), flags=re.S).strip()
                            for n in s["visuals"]]
    for s in syms["sections"]:
        for it in s.get("items", []):
            it["svg"] = to_svg(it["qet"], star=it.get("star"), notext=it.get("notext", False))
            it.setdefault("iec", it["qet"] if re.fullmatch(r"\d\d-\d\d-\d\d", it["qet"]) else "")
    data = {"built": datetime.date.today().isoformat(), "cheatsheet": cheat, "materials": materials, "devices": devices,
            "measurements": measurements, "symbols": syms}
    OUT.write_text("// Generated by tools/build.py from content/: edit those files, not this one.\n"
                   f"window.CHULETA = {json.dumps(data, ensure_ascii=False, separators=(',', ':'))};\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
