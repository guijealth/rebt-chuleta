"""Build data.js, the data the page reads, from the content files:

    content/cheatsheet.json   the chuleta (sections of [what, value, ref] rows, optional table)
    content/materials.json    the materials (cables, tubes, enclosures, sockets…), same format as the chuleta
    content/devices.json      the devices (PIA, differential…), same format as the chuleta
    content/measurements.json the measuring instruments and tests, same format as the chuleta
    content/calculators.json  the calculators behind the 🖩 buttons, attached to rows of the four sheets above
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


IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def num(text):
    """'15,3' → 15.3 (the chuleta writes numbers with a decimal comma)."""
    return float(text.replace(" ", "").replace(",", "."))


def check_calculators(calcs, sheets, cheat):
    """Every calculator attaches to existing rows, has well-formed inputs and outputs, and its constants agree with
    the chuleta. Returns (errors, {(file, section, key): calculator id})."""
    errors, attach, ids = [], {}, set()
    rows = {(s["title"], r[0]): f for f, sheet in sheets.items() for s in sheet["sections"] for r in s.get("rows", [])}
    for c in calcs.get("calculators", []):
        where = f"calculators.json, {c.get('id', '?')}"
        if not c.get("id") or c["id"] in ids:
            errors.append(f"{where}: missing or repeated id")
        ids.add(c.get("id"))
        names = set()
        for i in c.get("inputs", []):
            if not IDENT.match(i.get("id", "")):
                errors.append(f"{where}: input id {i.get('id')!r} must be a plain identifier")
            names.add(i.get("id"))
            if i.get("type") == "select" and "default" in i and i["default"] not in [o["value"] for o in i["options"]]:
                errors.append(f"{where}: default of {i['id']} is not one of its options")
        for k in c.get("example", {}):
            if k not in names:
                errors.append(f"{where}: example sets {k!r}, which is not an input")
        if not c.get("outputs") or any(not o.get("expr") for o in c["outputs"]):
            errors.append(f"{where}: every output needs an expr")
        for sec, key in c.get("rows", []):
            if (sec, key) not in rows:
                errors.append(f"{where}: no row «{key}» in section «{sec}»")
            elif (sec, key) in attach:
                errors.append(f"{where}: row «{key}» already has the calculator {attach[(sec, key)]}")
            else:
                attach[(sec, key)] = c["id"]
    # the constants must be the chuleta's own figures
    k = calcs.get("constants", {})
    secs = next((r[1] for s in cheat["sections"] for r in s.get("rows", []) if r[0] == "Secciones normalizadas (mm²)"), "")
    if [num(x) for x in secs.split("·")] != k.get("secciones"):
        errors.append("calculators.json: constants.secciones differ from the chuleta row «Secciones normalizadas (mm²)»")
    tab = next((s["table"] for s in cheat["sections"] if s["title"].startswith("Coeficientes de simultaneidad")), None)
    if tab:
        pairs = {}
        for r in tab["rows"]:
            for a, b in ((r[0], r[1]), (r[2], r[3])):
                if a.isdigit():
                    pairs[int(a)] = num(b)
        if [pairs[i] for i in sorted(pairs)] != k.get("coefSimultaneidad"):
            errors.append("calculators.json: constants.coefSimultaneidad differ from the chuleta's ITC-BT-10 table 1")
    return errors, attach


def main():
    cheat, materials, devices, measurements, syms = (load(f) for f in (
        "cheatsheet.json", "materials.json", "devices.json", "measurements.json", "symbols.json"))
    calcs = load("calculators.json")
    sheets = {"cheatsheet": cheat, "materials": materials, "devices": devices, "measurements": measurements}
    calc_errors, attach = check_calculators(calcs, sheets, cheat)
    errors = (check_cheatsheet(cheat) + check_cheatsheet(materials, "materials.json") + check_cheatsheet(devices, "devices.json")
              + check_cheatsheet(measurements, "measurements.json") + check_symbols(syms) + calc_errors)
    if errors:
        raise SystemExit("\n".join(errors))
    rows = lambda c: sum(len(s.get("rows", [])) + len(s.get("table", {}).get("rows", [])) for s in c["sections"])
    n_syms = sum(len(s.get("items", [])) for s in syms["sections"])
    print(f"content ok: chuleta {len(cheat['sections'])} sections, {rows(cheat)} rows · "
          f"materials {len(materials['sections'])} sections, {rows(materials)} rows · "
          f"devices {len(devices['sections'])} sections, {rows(devices)} rows · "
          f"measurements {len(measurements['sections'])} sections, {rows(measurements)} rows · {n_syms} symbols · "
          f"{len(calcs['calculators'])} calculators on {len(attach)} rows")
    if "--check" in sys.argv:
        return
    for c in (cheat, materials, devices, measurements, syms, calcs):
        c.pop("_doc", None)
    for sheet in sheets.values():  # the calculator of a row travels as its 4th element
        for s in sheet["sections"]:
            for r in s.get("rows", []):
                if (s["title"], r[0]) in attach:
                    r.append(attach[(s["title"], r[0])])
    for c in calcs["calculators"]:
        c.pop("rows", None)
    for s in cheat["sections"] + materials["sections"] + devices["sections"] + measurements["sections"]:
        if s.get("visuals"):  # inline SVG, without the XML prolog or comments
            s["visuals"] = [re.sub(r"<\?xml[^>]*>|<!--.*?-->", "", (VISUALS / f"{n}.svg").read_text(encoding="utf-8"), flags=re.S).strip()
                            for n in s["visuals"]]
    for s in syms["sections"]:
        for it in s.get("items", []):
            it["svg"] = to_svg(it["qet"], star=it.get("star"), notext=it.get("notext", False))
            it.setdefault("iec", it["qet"] if re.fullmatch(r"\d\d-\d\d-\d\d", it["qet"]) else "")
    data = {"built": datetime.date.today().isoformat(), "cheatsheet": cheat, "materials": materials, "devices": devices,
            "measurements": measurements, "symbols": syms, "calculators": calcs}
    OUT.write_text("// Generated by tools/build.py from content/: edit those files, not this one.\n"
                   f"window.CHULETA = {json.dumps(data, ensure_ascii=False, separators=(',', ':'))};\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
