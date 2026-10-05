"""UNE-EN 60617 (IEC 60617) graphical symbols, converted to SVG for the symbol sheet.

The drawings are not redrawn by hand: they come from the QElectroTech element collection, which files each
symbol of EN 60617 under its official reference number (part-section-number, e.g. 07-13-05 = circuit breaker).
The elements in use are vendored in content/elements/qet/ (CC-BY 3.0, see ELEMENTS.LICENSE there) and converted
here with their geometry untouched; only colour follows the page (currentColor).

    python3 tools/symbols.py --vendor <qelectrotech-elements checkout>   # copies the .elmt files symbols.json needs

content/symbols.json names each symbol's element by its EN 60617 number ("07-13-05") or, for composites and our
corrections, by a path under content/elements/ (qet/…, fixed/…). tools/build.py calls to_svg() for each one.
"""

import json
import math
import re
import shutil
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QET = ROOT / "content" / "elements" / "qet"
SPEC = ROOT / "content" / "symbols.json"

WEIGHT = {"thin": 0.5, "normal": 1, "hight": 2, "eleve": 4}  # QElectroTech's own spellings
DASH = {"dashed": "4 2", "dotted": "1 2", "dashdotted": "4 2 1 2"}
FONT = "Barlow, 'Helvetica Neue', Arial, sans-serif"


def element_file(ref):
    """'07-13-05' → content/elements/qet/en_60617_07_13_05.elmt; anything else is a path under content/elements/
    (qet/… for composite QElectroTech elements, fixed/… for our corrections of wrong elements)."""
    if re.fullmatch(r"\d\d-\d\d-\d\d\w*", ref):
        return QET / f"en_60617_{ref.replace('-', '_')}.elmt"
    return QET.parent / ref


def style(attr):
    s = dict(kv.split(":", 1) for kv in attr.get("style", "").split(";") if ":" in kv)
    width = WEIGHT.get(s.get("line-weight", "normal"), 1)
    fill = s.get("filling", "none")
    out = [f'stroke-width="{width:g}"']
    if s.get("line-style") in DASH:
        out.append(f'stroke-dasharray="{DASH[s["line-style"]]}"')
    if s.get("color") == "white":
        out.append('stroke="var(--card, #fff)"')
    if fill == "black":
        out.append('fill="currentColor"')
    elif fill == "white":
        out.append('fill="var(--card, #fff)"')
    elif fill in ("bdiag", "fdiag", "hor", "ver"):
        out.append(f'fill="url(#hatch-{fill})"')
    return " ".join(out), width


def arrow(x1, y1, x2, y2, kind, size):
    """Line end (at x2, y2) as QElectroTech draws it."""
    a = math.atan2(y2 - y1, x2 - x1)
    if kind in ("simple", "triangle"):
        p = [(x2 - size * math.cos(a + s), y2 - size * math.sin(a + s)) for s in (0.5, -0.5)]
        pts = f"{p[0][0]:.2f},{p[0][1]:.2f} {x2:.2f},{y2:.2f} {p[1][0]:.2f},{p[1][1]:.2f}"
        return f'<polygon points="{pts}" fill="currentColor"/>' if kind == "triangle" else f'<polyline points="{pts}" fill="none"/>'
    if kind == "circle":
        return f'<circle cx="{x2 - size / 2 * math.cos(a):.2f}" cy="{y2 - size / 2 * math.sin(a):.2f}" r="{size / 2:.2f}" fill="none"/>'
    if kind == "diamond":
        c = (x2 - size / 2 * math.cos(a), y2 - size / 2 * math.sin(a))
        pts = " ".join(f"{c[0] + size / 2 * math.cos(a + k * math.pi / 2):.2f},{c[1] + size / 2 * math.sin(a + k * math.pi / 2):.2f}" for k in range(4))
        return f'<polygon points="{pts}" fill="none"/>'
    return ""


def to_svg(ref, star=None, notext=False, scale=1.6, pad=3):
    """SVG of one EN 60617 element. star: text that replaces the '*' placeholder of general symbols
    (machine M/G, measuring instrument V/A…), as the standard asks. notext drops the element's own
    captions (e.g. "Form 1")."""
    root = ET.parse(element_file(ref)).getroot()
    desc = root.find("description")
    if star is not None:  # the '*' is drawn with small filled shapes inside the circle: drop them
        ring = next(e for e in desc if e.tag in ("ellipse", "circle"))
        rx0, ry0 = float(ring.get("x")), float(ring.get("y"))
        rw = float(ring.get("width") or ring.get("diameter"))
        rc = (rx0 + rw / 2, ry0 + rw / 2)
        def inside(e):
            nums = [float(v) for k, v in e.attrib.items() if re.fullmatch(r"[xy]\d*", k)]
            return nums and all(abs(v - rc[i % 2]) < rw / 4 for i, v in enumerate(nums))
        for e in [e for e in desc if e.tag in ("polygon", "rect") and inside(e)]:
            desc.remove(e)
    if notext:
        for e in [e for e in desc if e.tag == "text"]:
            desc.remove(e)
    parts, xs, ys = [], [], []

    def box(x0, y0, x1, y1, w=0):
        xs.extend((x0 - w / 2, x1 + w / 2))
        ys.extend((y0 - w / 2, y1 + w / 2))

    for e in desc:
        a = {k: v for k, v in e.attrib.items()}
        f = lambda k: float(a.get(k, 0))
        st, w = style(a) if e.tag != "text" else ("", 0)
        if e.tag == "line":
            x1, y1, x2, y2 = f("x1"), f("y1"), f("x2"), f("y2")
            if math.hypot(x2 - x1, y2 - y1) < 1.5:
                continue  # stray dot left in some elements (e.g. under the earth symbol 02-15-01)
            parts.append(f'<line x1="{x1:g}" y1="{y1:g}" x2="{x2:g}" y2="{y2:g}" {st}/>')
            for end, (ax, ay, bx, by) in (("end1", (x2, y2, x1, y1)), ("end2", (x1, y1, x2, y2))):
                if a.get(end, "none") != "none":
                    parts.append(arrow(ax, ay, bx, by, a[end], float(a.get("length" + end[-1], 1.5)) * 2.5))
            box(min(x1, x2), min(y1, y2), max(x1, x2), max(y1, y2), w)
        elif e.tag == "rect":
            x, y, wd, ht = f("x"), f("y"), f("width"), f("height")
            rx = f' rx="{f("rx"):g}"' if a.get("rx") and f("rx") else ""
            parts.append(f'<rect x="{x:g}" y="{y:g}" width="{wd:g}" height="{ht:g}"{rx} {st}/>')
            box(x, y, x + wd, y + ht, w)
        elif e.tag in ("ellipse", "circle"):
            x, y = f("x"), f("y")
            wd = f("width") if "width" in a else f("diameter")
            ht = f("height") if "height" in a else f("diameter")
            parts.append(f'<ellipse cx="{x + wd / 2:g}" cy="{y + ht / 2:g}" rx="{wd / 2:g}" ry="{ht / 2:g}" {st}/>')
            box(x, y, x + wd, y + ht, w)
        elif e.tag == "arc":
            # Qt: angles in degrees from 3 o'clock, positive = counter-clockwise on screen
            x, y, wd, ht, s0, sw = f("x"), f("y"), f("width"), f("height"), f("start"), f("angle")
            cx, cy, rx, ry = x + wd / 2, y + ht / 2, wd / 2, ht / 2
            pt = lambda t: (cx + rx * math.cos(math.radians(t)), cy - ry * math.sin(math.radians(t)))
            (px, py), (qx, qy) = pt(s0), pt(s0 + sw)
            large = 1 if abs(sw) > 180 else 0
            sweep = 0 if sw > 0 else 1
            parts.append(f'<path d="M{px:.2f},{py:.2f} A{rx:g},{ry:g} 0 {large} {sweep} {qx:.2f},{qy:.2f}" {st}/>')
            steps = [pt(s0 + sw * k / 24) for k in range(25)]
            box(min(p[0] for p in steps), min(p[1] for p in steps), max(p[0] for p in steps), max(p[1] for p in steps), w)
        elif e.tag == "polygon":
            pts, n = [], 1
            while f"x{n}" in a:
                pts.append((f(f"x{n}"), f(f"y{n}")))
                n += 1
            tag = "polyline" if a.get("closed") == "false" else "polygon"
            if tag == "polyline" and "fill=" not in st:
                st += ' fill="none"'
            parts.append(f'<{tag} points="{" ".join(f"{x:g},{y:g}" for x, y in pts)}" {st}/>')
            box(min(p[0] for p in pts), min(p[1] for p in pts), max(p[0] for p in pts), max(p[1] for p in pts), w)
        elif e.tag == "text":
            size = float(a.get("size") or a.get("font", "x,9").split(",")[1])
            x, y, txt = f("x"), f("y"), a.get("text", "")
            rot = f' transform="rotate({f("rotation"):g} {x:g} {y:g})"' if f("rotation") else ""
            parts.append(f'<text x="{x:g}" y="{y:g}" font-size="{size * 1.25:g}" fill="currentColor" stroke="none"{rot}>{esc(txt)}</text>')
            box(x, y - size * 1.25, x + size * 0.62 * len(txt), y + size * 0.3)
    if star is not None:
        e = next(e for e in desc if e.tag in ("ellipse", "circle", "rect"))
        a = {k: float(v) for k, v in e.attrib.items() if k in ("x", "y", "width", "height", "diameter")}
        wd, ht = a.get("width", a.get("diameter")), a.get("height", a.get("diameter"))
        cx, cy = a["x"] + wd / 2, a["y"] + ht / 2
        lines = star.split("\n")
        fs = min(ht * 0.34, 14)
        for i, t in enumerate(lines):
            ty = cy + fs * 0.36 + (i - (len(lines) - 1) / 2) * fs * 1.05
            parts.append(f'<text x="{cx:g}" y="{ty:.2f}" font-size="{fs:.1f}" text-anchor="middle" fill="currentColor" stroke="none">{esc(t)}</text>')
    x0, y0, x1, y1 = min(xs) - pad, min(ys) - pad, max(xs) + pad, max(ys) + pad
    w, h = x1 - x0, y1 - y0
    hatch = "".join(
        f'<pattern id="hatch-{k}" width="4" height="4" patternUnits="userSpaceOnUse"><path d="{d}" stroke="currentColor" stroke-width="0.6"/></pattern>'
        for k, d in (("bdiag", "M0,4 L4,0"), ("fdiag", "M0,0 L4,4"), ("hor", "M0,2 H4"), ("ver", "M2,0 V4")))
    defs = f"<defs>{hatch}</defs>" if "url(#hatch" in "".join(parts) else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:g} {y0:g} {w:g} {h:g}" width="{w * scale:.0f}" height="{h * scale:.0f}" '
            f'role="img" fill="none" stroke="currentColor" stroke-linecap="square" font-family="{FONT}">{defs}{"".join(parts)}</svg>')


def esc(t):
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def vendor(src):
    """Copy the elements symbols.json uses from a qelectrotech-elements checkout (plus its licence)."""
    src = Path(src)
    QET.mkdir(parents=True, exist_ok=True)
    shutil.copy(src / "ELEMENTS.LICENSE", QET / "ELEMENTS.LICENSE")
    spec = json.loads(SPEC.read_text(encoding="utf-8"))
    for sec in spec["sections"]:
        for it in sec.get("items", []):
            if not re.fullmatch(r"\d\d-\d\d-\d\d\w*|qet/.*", it["qet"]):
                continue  # our own corrected elements (fixed/)
            name = element_file(it["qet"]).name
            hits = list(src.glob(f"10_electric/**/{name}"))
            if not hits:
                raise SystemExit(f"{name} not found in {src}")
            shutil.copy(hits[0], QET / name)
            print("copied", hits[0].relative_to(src))


if __name__ == "__main__":
    if sys.argv[1:2] != ["--vendor"] or len(sys.argv) != 3:
        raise SystemExit(__doc__)
    vendor(sys.argv[2])
