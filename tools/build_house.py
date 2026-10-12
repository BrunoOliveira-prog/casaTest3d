#!/usr/bin/env python3
"""
Gera src/data/house/casa-de-campo.json a partir da leitura da planta (planta.png).

Convenção: 1 unidade = 1 m. X = leste (direita da planta), Z = sul (baixo da planta / FRENTE), Y = altura.
Origem = canto noroeste externo da casa. Norte = -Z.

Calibração da imagem de referência (conflito registrado):
  largura  15,80 m  <-> 1206 px  (x: 122 -> 1328)   => 0,013101 m/px
  profund. 12,20 m  <-> 765 px   (y: 122 -> 887)    => 0,015948 m/px
O desenho tem escala X != escala Z; por isso a imagem de referência usa duas escalas.
"""
import json, math, os, sys

SX = 15.80 / 1206.0
SZ = 12.20 / 765.0
def X(px): return round((px - 122) * SX, 3)
def Z(py): return round((py - 122) * SZ, 3)
def snap(v, s=0.05): return round(round(v / s) * s, 3)

OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'house', 'casa-de-campo.json')

# --------------------------------------------------------------------------- parâmetros
PARAMS = {
    "wallExtT": 0.25, "wallIntT": 0.12, "wallMidT": 0.15,
    "roofThick": 0.16, "eave": 0.45, "floorThick": 0.02, "slabThick": 0.15,
    "footingW": 0.55, "footingDepth": 0.60,
    "doorH": 2.10, "doorW": 0.80, "entryDoorH": 2.20,
    "ridgeMax": 4.90, "ceilingBase": 2.80,
    "eyeHeight": 1.60,
}

# --------------------------------------------------------------------------- telhados (plano = face inferior)
# plane: h(x,z) = h0 + gx*(x-x0) + gz*(z-z0)
def rect(x0, z0, x1, z1): return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
E = 0.45
ROOFS = [
  {"id": "RW", "name": "Telhado ala oeste (uma água)", "src": "estimado",
   "polygon": [[-E, -E], [3.40, -E], [3.40, 3.75], [3.61, 3.75], [3.61, 9.625+E], [-E, 9.625+E]],
   "holes": [], "plane": {"x0": -E, "z0": 0, "h0": 2.80, "gx": 0.10, "gz": 0.0},
   "note": "Cai para oeste, inclinação 10% (planta de cobertura). Alturas estimadas."},
  {"id": "RC", "name": "Telhado volume social central (uma água)", "src": "estimado",
   "polygon": [[3.40, -E], [13.10, -E], [13.10, 7.65], [10.95, 7.65], [10.95, 5.80], [4.80, 5.80], [4.80, 9.65], [3.61, 9.65], [3.61, 3.75], [3.40, 3.75]],
   "holes": [rect(3.80, 8.55, 4.42, 9.45)],
   "plane": {"x0": 0, "z0": 0, "h0": 4.74, "gx": 0.0, "gz": -0.17},
   "note": "Cai para o sul (frente). Cumeeira mais alta ao norte: 4,90 m (cota das fachadas). Inclinação ≈17% adotada pela ficha (8–10°)."},
  {"id": "RH", "name": "Telhado do hall de entrada (uma água)", "src": "estimado",
   "polygon": [[2.00, 9.65], [4.95, 9.65], [4.95, 12.20+E], [2.00, 12.20+E]],
   "holes": [], "plane": {"x0": 0, "z0": 9.65, "h0": 3.85, "gx": 0.0, "gz": -0.10},
   "note": "Volume do hall mais alto que as alas (caixa em madeira das fachadas)."},
  {"id": "RN", "name": "Telhado ala leste norte (lavanderia/banho)", "src": "estimado",
   "polygon": [[13.10, -E], [15.80+E, -E], [15.80+E, 7.10], [13.10, 7.10]],
   "holes": [], "plane": {"x0": 13.10, "z0": 0, "h0": 3.40, "gx": -0.10, "gz": 0.0},
   "note": "Cai para leste, inclinação 10%."},
  {"id": "RS", "name": "Telhado da suíte (uma água)", "src": "estimado",
   "polygon": [[10.95, 7.65], [13.10, 7.65], [13.10, 7.10], [15.80+E, 7.10], [15.80+E, 10.35+E], [10.95, 10.35+E]],
   "holes": [], "plane": {"x0": 10.95, "z0": 0, "h0": 3.30, "gx": -0.10, "gz": 0.0},
   "note": "Cai para leste, inclinação 10%."},
]
ROOF_BY_ID = {r["id"]: r for r in ROOFS}

def plane_h(r, x, z):
    p = r["plane"]; return p["h0"] + p["gx"] * (x - p["x0"]) + p["gz"] * (z - p["z0"])

def pip(poly, x, z):
    inside = False; n = len(poly)
    for i in range(n):
        x1, z1 = poly[i]; x2, z2 = poly[(i + 1) % n]
        if (z1 > z) != (z2 > z):
            xi = x1 + (z - z1) * (x2 - x1) / (z2 - z1)
            if xi > x: inside = not inside
    return inside

def in_roof(r, x, z, infl=0.0):
    # inflação aproximada: testa 5 pontos ao redor
    pts = [(x, z)] if infl == 0 else [(x, z), (x+infl, z), (x-infl, z), (x, z+infl), (x, z-infl)]
    for (px, pz) in pts:
        if pip(r["polygon"], px, pz) and not any(pip(h, px, pz) for h in r["holes"]):
            return True
    return False

def top_at(x, z, infl=0.14):
    best = None; bid = None
    for r in ROOFS:
        if in_roof(r, x, z, infl):
            h = plane_h(r, x, z)
            if best is None or h > best: best, bid = h, r["id"]
    if best is None:  # fallback: plano mais próximo
        best = 2.80; bid = None
    return best, bid

# --------------------------------------------------------------------------- paredes
T_EXT, T_INT, T_MID = PARAMS["wallExtT"], PARAMS["wallIntT"], PARAMS["wallMidT"]
xW, xE, zN = 0.125, 15.675, 0.125
zSs, zHs, xHw = 10.225, 12.075, 2.165

WALLS = []
def W(id, a, b, t, kind, name, material="reboco", openings=None, src="confirmado", note="", height=None):
    tcls = "ext" if t == T_EXT else ("int" if t == T_INT else ("mid" if t == T_MID else "custom"))
    WALLS.append({"id": id, "a": list(a), "b": list(b), "t": t, "tClass": tcls, "kind": kind, "name": name, "material": material,
                  "openings": openings or [], "src": src, "note": note, **({"height": height} if height else {})})

# --- aberturas helper (posição ao longo da parede medida a partir de 'a')
def op(id, typ, center, w, h, sill=0.0, mat="aluminio-preto", src="confirmado", name=None, note="", passable=None, swing=None):
    d = {"id": id, "type": typ, "center": center, "w": w, "h": h, "sill": sill, "material": mat, "src": src}
    if name: d["name"] = name
    if note: d["note"] = note
    if passable is not None: d["passable"] = passable
    if swing: d["swing"] = swing
    return d

# Parede norte (a -> b: oeste -> leste). Janelas do desenho (px 210-290 / 468-548 / 931-997 / 1154-1220)
def cx(p0, p1): return snap((X(p0) + X(p1)) / 2 - xW, 0.01)
W("P-N", (xW, zN), (xE, zN), T_EXT, "ext", "Parede externa norte (fundos)", openings=[
    op("J-N1", "window", cx(210, 290), 1.05, 1.40, 0.90, name="Janela do Quarto 2 (norte)", src="confirmado", note="Posição e largura lidas da planta; altura estimada."),
    op("J-N2", "window", cx(468, 548), 1.05, 1.40, 0.90, name="Janela da sala (norte)", note="Posição e largura lidas da planta; altura estimada."),
    op("J-N3", "window", cx(931, 997), 0.90, 1.00, 1.10, name="Janela da cozinha (norte)", note="Posição e largura lidas da planta; altura estimada."),
    op("J-N4", "window", cx(1154, 1220), 0.90, 0.80, 1.40, name="Janela da lavanderia (norte)", note="Janela alta (fachada de fundos). Altura estimada."),
])
# Parede leste (a: norte -> b: sul)
def cz(p0, p1, z0): return snap((Z(p0) + Z(p1)) / 2 - z0, 0.01)
W("P-L", (xE, zN), (xE, zSs), T_EXT, "ext", "Parede externa leste", openings=[
    op("J-L1", "window", cz(199, 257, zN), 0.90, 1.00, 1.10, name="Janela da lavanderia (leste)", note="Altura estimada."),
    op("J-L2", "window", cz(374, 431, zN), 0.90, 0.70, 1.50, name="Janela do banheiro da suíte (leste)", note="Janela alta, altura estimada."),
    op("J-L3", "window", cz(567, 745, zN), 2.80, 1.72, 0.40, name="Janela de canto da suíte (leste)", note="Janela panorâmica (planta); altura/peitoril lidos da fachada."),
])
# Parede sul da suíte (a: leste -> b: oeste)
W("P-SS", (xE, zSs), (11.15, zSs), T_EXT, "ext", "Parede externa sul da suíte", openings=[
    op("J-S1", "window", snap(xE - (X(1086) + X(1310)) / 2, 0.01), 2.90, 1.72, 0.40, name="Janela de canto da suíte (sul)", note="Janela panorâmica em duas folhas; altura/peitoril lidos da fachada."),
])
# Parede oeste da suíte (a: sul -> b: norte) — divisa com o pátio
W("P-SO", (11.15, zSs), (11.15, 4.38), 0.25, "ext", "Parede da suíte voltada ao pátio", openings=[
    op("P-SU1", "door", snap(zSs - 8.85, 0.01), 0.90, 2.10, 0.0, mat="madeira-escura", name="Porta da suíte para o pátio", passable=True, swing="in"),
], note="Espessura 25 cm estimada (desenho mostra parede espessa).")
W("P-SN", (11.15, 4.38), (13.10, 4.38), T_INT, "int", "Parede norte da suíte", material="reboco-int", openings=[
    op("P-SU2", "door", snap(11.69 - 11.15, 0.01), 0.80, 2.10, 0.0, mat="madeira-clara", name="Porta da suíte para a cozinha", passable=True, swing="in"),
])
W("P-CE", (13.10, zN), (13.10, 6.12), T_INT, "int", "Parede cozinha | lavanderia | banheiro da suíte", material="reboco-int", openings=[
    op("P-LAV", "door", snap(2.50 - zN, 0.01), 0.80, 2.10, 0.0, mat="madeira-clara", name="Porta da lavanderia", passable=True, swing="in"),
    op("P-BS", "door", snap(5.40 - zN, 0.01), 0.70, 2.10, 0.0, mat="madeira-clara", name="Porta do banheiro da suíte", passable=True, swing="in"),
])
W("P-LB", (13.10, 3.15), (xE, 3.15), T_INT, "int", "Parede lavanderia | banheiro da suíte", material="reboco-int")
W("P-BSS", (13.10, 6.12), (xE, 6.12), T_INT, "int", "Parede sul do banheiro da suíte", material="reboco-int")
W("P-STUB", (9.25, zN), (9.25, 0.90), T_MID, "stub", "Painel divisor sala | cozinha", material="reboco-int",
  note="Trecho curto de parede entre sala e cozinha; o restante da divisa é aberto (linha tracejada).")
# Parede de vidro / sala-pátio
W("P-VID", (4.58, 5.50), (11.15, 5.50), T_INT, "glazing", "Parede de vidro sala/cozinha | pátio", material="reboco", openings=[
    op("E-VID", "slider", snap((X(490) + X(950)) / 2 - 4.58, 0.01), snap(X(950) - X(490), 0.01), 2.45, 0.0, name="Esquadria de correr sala/cozinha para o pátio", passable=True,
       note="Quatro folhas de correr (planta). Vão contínuo sala + cozinha."),
])
W("P-PO", (4.58, 5.50), (4.58, 12.075), T_EXT, "ext", "Parede oeste do pátio / leste do hall")
W("P-HS", (4.58, zHs), (xHw, zHs), T_EXT, "ext", "Parede sul do hall (entrada)", openings=[
    op("P-ENT", "door", snap(4.58 - 3.95, 0.01), 1.00, 2.20, 0.0, mat="madeira-escura", name="Porta de entrada (madeira)", passable=True, swing="in", note="Porta pivotante em madeira com puxador vertical (fachada)."),
])
W("P-HO", (xHw, zHs), (xHw, 9.50), T_EXT, "ext", "Parede oeste do hall", openings=[
    op("J-H1", "window", snap(zHs - 10.80, 0.01), 1.00, 1.50, 0.60, name="Janela lateral do hall", note="Iluminação lateral estreita (ficha). Altura estimada."),
])
W("P-Q3S", (xW, 9.50), (xHw, 9.50), T_EXT, "ext", "Parede sul do Quarto 3", openings=[
    op("J-Q3S", "window", snap((X(184) + X(239)) / 2 - xW, 0.01), 0.72, 0.90, 1.10, name="Janela do Quarto 3 (sul)", note="Janela pequena; altura estimada."),
])
W("P-HN", (xHw, 9.50), (4.58, 9.50), T_MID, "int", "Parede norte do hall", material="reboco-int", openings=[
    op("P-HALL", "door", snap(4.05 - xHw, 0.01), 0.80, 2.10, 0.0, mat="madeira-clara", src="estimado", name="Porta hall → circulação (ESTIMADA)", passable=True, swing="in",
       note="O desenho não mostra passagem entre o hall e o restante da casa. Porta estimada para tornar o interior navegável."),
])
W("P-O", (xW, 9.50), (xW, zN), T_EXT, "ext", "Parede externa oeste", openings=[
    op("J-O1", "window", snap(9.50 - 1.94, 0.01), 1.40, 1.65, 0.75, name="Janela do Quarto 2 (oeste)", note="Janela vertical (fachada esquerda)."),
    op("J-O2", "window", snap(9.50 - 4.94, 0.01), 0.88, 0.95, 1.45, name="Janela do banheiro social (oeste)", note="Janela pequena e alta (fachada esquerda)."),
    op("J-O3", "window", snap(9.50 - 7.71, 0.01), 1.40, 1.65, 0.75, name="Janela do Quarto 3 (oeste)", note="Janela vertical (fachada esquerda)."),
])
W("P-Q2L", (3.40, zN), (3.40, 3.75), T_MID, "int", "Parede Quarto 2 | sala", material="reboco-int")
W("P-Q2S", (xW, 3.75), (3.61, 3.75), T_INT, "int", "Parede sul do Quarto 2 / norte do banheiro", material="reboco-int", openings=[
    op("P-Q2", "door", snap(2.94 - xW, 0.01), 0.80, 2.10, 0.0, mat="madeira-clara", name="Porta do Quarto 2", passable=True, swing="in"),
])
W("P-CE1", (3.61, 3.75), (3.61, 5.93), T_MID, "int", "Parede da circulação (leste, trecho norte)", material="reboco-int")
W("P-CE2", (3.61, 7.90), (3.61, 9.50), T_MID, "int", "Parede leste do Quarto 3 (trecho sul)", material="reboco-int")
W("P-BE", (2.50, 3.75), (2.50, 5.95), T_INT, "int", "Parede banheiro social | circulação", material="reboco-int", openings=[
    op("P-BSO", "door", snap(5.40 - 3.75, 0.01), 0.80, 2.10, 0.0, mat="madeira-clara", name="Porta do banheiro social", passable=True, swing="in"),
])
W("P-BSOC", (xW, 5.95), (2.50, 5.95), T_INT, "int", "Parede banheiro social | Quarto 3", material="reboco-int")
W("P-Q3E", (2.50, 5.95), (2.50, 7.90), T_INT, "int", "Parede Quarto 3 | circulação", material="reboco-int", openings=[
    op("P-Q3", "door", snap(6.60 - 5.95, 0.01), 0.80, 2.10, 0.0, mat="madeira-clara", name="Porta do Quarto 3 / escritório", passable=True, swing="in"),
])
W("P-CB", (2.50, 7.90), (3.61, 7.90), T_INT, "int", "Parede de fundo da circulação", material="reboco-int")
W("P-MURO", (4.58, zSs), (11.15, zSs), T_EXT, "muro", "Muro baixo do pátio", src="estimado", height=1.10,
  note="Muro baixo off-white na frente do pátio (ficha e fachadas). Altura 1,10 m estimada.")

# --------------------------------------------------------------------------- junções (retração/extensão) + perfil de topo
def L(w): return math.hypot(w["b"][0] - w["a"][0], w["b"][1] - w["a"][1])
def dirv(w):
    l = L(w); return ((w["b"][0] - w["a"][0]) / l, (w["b"][1] - w["a"][1]) / l)
def horizontal(w): return abs(w["a"][1] - w["b"][1]) < 1e-6
def on_axis_interior(w, p, eps=0.02):
    ax, az = w["a"]; bx, bz = w["b"]
    if horizontal(w):
        return abs(p[1] - az) < eps and min(ax, bx) + eps < p[0] < max(ax, bx) - eps
    return abs(p[0] - ax) < eps and min(az, bz) + eps < p[1] < max(az, bz) - eps
def tval(w):
    return {"ext": T_EXT, "int": T_INT, "stub": T_MID, "glazing": T_INT, "muro": T_EXT}[w["kind"]] if isinstance(w["t"], str) else w["t"]
def at_end(w, p, eps=0.02): return math.hypot(w["a"][0]-p[0], w["a"][1]-p[1]) < eps or math.hypot(w["b"][0]-p[0], w["b"][1]-p[1]) < eps

for w in WALLS: w["tt"] = tval(w); w["ea"] = 0.0; w["eb"] = 0.0   # ajuste de extremidade (m): + estende, - retrai

for w in WALLS:
    for end, key in ((w["a"], "ea"), (w["b"], "eb")):
        if w["kind"] == "muro":
            # o muro baixo não participa das junções dos outros; ele recua até a face da parede que encontra
            hit = [o for o in WALLS if o is not w and o["kind"] != "muro" and horizontal(o) != horizontal(w) and (on_axis_interior(o, end) or at_end(o, end))]
            if hit: w[key] = -max(o["tt"] for o in hit) / 2
            continue
        others = [o for o in WALLS if o is not w and o["kind"] != "muro"]
        through_perp = [o for o in others if on_axis_interior(o, end) and horizontal(o) != horizontal(w)]
        coll_end = [o for o in others if at_end(o, end) and horizontal(o) == horizontal(w)]
        perp_end = [o for o in others if at_end(o, end) and horizontal(o) != horizontal(w)]
        if through_perp:
            w[key] = -max(o["tt"] for o in through_perp) / 2
        elif coll_end:
            w[key] = 0.0
        elif perp_end and horizontal(w):
            w[key] = max(o["tt"] for o in perp_end) / 2

def seg_intersections(w, poly):
    # parâmetros s (distância ao longo da parede) onde a parede cruza arestas do polígono
    ax, az = w["a"]; dx, dz = dirv(w); l = L(w); res = []
    n = len(poly)
    for i in range(n):
        x1, z1 = poly[i]; x2, z2 = poly[(i + 1) % n]
        ex, ez = x2 - x1, z2 - z1
        den = dx * ez - dz * ex
        if abs(den) < 1e-9: continue
        s = ((x1 - ax) * ez - (z1 - az) * ex) / den
        u = ((x1 - ax) * dz - (z1 - az) * dx) / den
        if 0 < s < l and 0 <= u <= 1: res.append(s)
    return res

def top_profile(w):
    """Perfil de topo [(s, h)...] com degraus nas fronteiras dos telhados."""
    l = L(w); ax, az = w["a"]; dx, dz = dirv(w)
    s0, s1 = -w["ea"], l + w["eb"]    # extensão total
    bps = {s0, s1}
    for r in ROOFS:
        for poly in [r["polygon"]] + r["holes"]:
            for s in seg_intersections(w, poly): bps.add(round(s, 4))
    bps = sorted(b for b in bps if s0 - 1e-6 <= b <= s1 + 1e-6)
    prof = []
    for i in range(len(bps) - 1):
        sa, sb = bps[i], bps[i + 1]
        if sb - sa < 1e-4: continue
        sm = (sa + sb) / 2
        mx, mz = ax + dx * sm, az + dz * sm
        _, rid = top_at(mx, mz)
        if rid is None: rid = "RC"
        r = ROOF_BY_ID[rid]
        ha = plane_h(r, ax + dx * sa, az + dz * sa); hb = plane_h(r, ax + dx * sb, az + dz * sb)
        prof.append([round(sa, 4), round(ha, 4), rid]); prof.append([round(sb, 4), round(hb, 4), rid])
    return prof

for w in WALLS:
    if w["kind"] == "muro" or w.get("height"):
        h = w.get("height", 1.1); l = L(w)
        w["top"] = {"mode": "flat", "h": h}
    else:
        w["top"] = {"mode": "profile", "profile": [[s, h] for s, h, _ in top_profile(w)], "roofs": sorted({rid for _, _, rid in top_profile(w)})}
    w["extA"] = round(w["ea"], 4); w["extB"] = round(w["eb"], 4)
    del w["ea"]; del w["eb"]; w["t"] = w.pop("tt")

# --------------------------------------------------------------------------- cômodos (polígonos = faces internas)
def inset_rect(x0, z0, x1, z1): return [[round(x0, 3), round(z0, 3)], [round(x1, 3), round(z0, 3)], [round(x1, 3), round(z1, 3)], [round(x0, 3), round(z1, 3)]]
ex = T_EXT / 2; ix = T_INT / 2; mx = T_MID / 2
ROOMS = [
  {"id": "R-Q2", "name": "Quarto 2", "nominal": [3.30, 3.20], "floor": "madeira",
   "polygon": inset_rect(xW + ex, zN + ex, 3.40 - mx, 3.75 - ix), "spot": [1.6, 1.9, 90]},
  {"id": "R-BSOC", "name": "Banheiro social", "nominal": [2.40, 1.70], "floor": "porcelanato",
   "polygon": inset_rect(xW + ex, 3.75 + ix, 2.50 - ix, 5.95 - ix), "spot": [1.5, 5.0, 0]},
  {"id": "R-Q3", "name": "Quarto 3 / escritório", "nominal": [3.20, 3.10], "floor": "madeira",
   "polygon": [[xW + ex, 5.95 + ix], [2.50 - ix, 5.95 + ix], [2.50 - ix, 7.90 + ix], [3.61 - mx, 7.90 + ix], [3.61 - mx, 9.50 - mx], [xW + ex, 9.50 - ex]], "spot": [1.5, 8.3, 90]},
  {"id": "R-CIRC", "name": "Circulação", "nominal": [1.20, None], "floor": "madeira",
   "polygon": [[2.50 + ix, 3.75 + ix], [3.61 - mx, 3.75 + ix], [3.61 - mx, 5.93], [3.61 - mx, 7.90 - ix], [2.50 + ix, 7.90 - ix]], "spot": [3.05, 4.3, 180]},
  {"id": "R-SALA", "name": "Sala de estar + jantar", "nominal": [6.00, 5.20], "floor": "madeira",
   "polygon": [[3.40 + mx, zN + ex], [9.25, zN + ex], [9.25, 5.50 - ix], [4.58 + ex, 5.50 - ix], [4.58 + ex, 9.50 - mx], [3.61 + mx, 9.50 - mx], [3.61 + mx, 5.93], [3.61 + mx, 3.75 + ix], [3.40 + mx, 3.75 + ix]], "spot": [6.2, 3.8, 0],
   "note": "Inclui a faixa de ligação (~0,8 m) entre a circulação e o hall. O limite com a cozinha é aberto."},
  {"id": "R-COZ", "name": "Cozinha", "nominal": [4.00, 3.50], "floor": "porcelanato",
   "polygon": [[9.25, zN + ex], [13.10 - ix, zN + ex], [13.10 - ix, 4.38 - ix], [11.15 + 0.125, 4.38 - ix], [11.15 + 0.125, 5.50 - ix], [9.25, 5.50 - ix]], "spot": [11.2, 3.0, 0],
   "note": "Aberta para a sala. Faixa sul voltada para o pátio."},
  {"id": "R-LAV", "name": "Lavanderia / área técnica", "nominal": [2.60, 2.10], "floor": "porcelanato",
   "polygon": inset_rect(13.10 + ix, zN + ex, xE - ex, 3.15 - ix), "spot": [14.4, 1.6, 270]},
  {"id": "R-BSU", "name": "Banheiro da suíte", "nominal": [2.40, 2.20], "floor": "porcelanato",
   "polygon": inset_rect(13.10 + ix, 3.15 + ix, xE - ex, 6.12 - ix), "spot": [14.4, 4.8, 270]},
  {"id": "R-SUI", "name": "Suíte principal", "nominal": [4.00, 3.60], "floor": "madeira",
   "polygon": [[11.15 + 0.125, 4.38 + ix], [13.10 - 0 + 0.0 - ix, 4.38 + ix], [13.10 - ix, 6.12 + ix], [xE - ex, 6.12 + ix], [xE - ex, zSs - ex], [11.15 + 0.125, zSs - ex]], "spot": [13.3, 7.0, 90]},
  {"id": "R-HALL", "name": "Hall de entrada", "nominal": [2.20, 2.00], "floor": "madeira",
   "polygon": inset_rect(xHw + ex, 9.50 + mx, 4.58 - ex, zHs - ex), "spot": [3.3, 11.4, 180]},
  {"id": "R-PATIO", "name": "Pátio / varanda central", "nominal": [6.20, 4.80], "floor": "cimenticio", "open": True,
   "polygon": inset_rect(4.58 + ex, 5.50 + ix, 11.15 - 0.125, zSs - ex), "spot": [7.9, 8.4, 0],
   "note": "Área descoberta (vazio na planta de cobertura). Piso cimentício."},
]
for r in ROOMS:
    r["level"] = "terreo"; r["src"] = "confirmado"
    r["areaSource"] = "polígono do modelo (faces internas das paredes)"
    # sanitiza coordenadas
    r["polygon"] = [[round(p[0], 3), round(p[1], 3)] for p in r["polygon"]]
    # remove ponto duplicado colinear
    clean = []
    for p in r["polygon"]:
        if not clean or (abs(clean[-1][0]-p[0]) > 1e-6 or abs(clean[-1][1]-p[1]) > 1e-6): clean.append(p)
    r["polygon"] = clean

def room_at(x, z):
    for r in ROOMS:
        if pip(r["polygon"], x, z): return r["id"]
    return None
for w in WALLS:
    ax, az = w["a"]; bx, bz = w["b"]; mxp, mzp = (ax+bx)/2, (az+bz)/2
    dx, dz = dirv(w); nx, nz = -dz, dx
    off = w["t"] / 2 + 0.2
    s1 = room_at(mxp + nx * off, mzp + nz * off); s2 = room_at(mxp - nx * off, mzp - nz * off)
    w["rooms"] = [r for r in (s1, s2) if r]

# --------------------------------------------------------------------------- pilares (nós) e caibros
def node_key(p): return (round(p[0], 2), round(p[1], 2))
nodes = {}
for w in WALLS:
    if w["kind"] in ("muro", "stub"): continue
    for end in (w["a"], w["b"]):
        nodes.setdefault(node_key(end), []).append(w)
PILLARS = []
for k, ws in nodes.items():
    ext = any(w["kind"] == "ext" for w in ws)
    # nó em T onde uma parede atravessa também conta: procura paredes que passem pelo nó
    through = [o for o in WALLS if o["kind"] not in ("muro", "stub") and on_axis_interior(o, k) and o not in ws]
    allw = ws + through
    h_ = any(horizontal(w) for w in allw); v_ = any(not horizontal(w) for w in allw)
    if not (h_ and v_): continue
    size = 0.25 if ext else 0.15
    top, _ = top_at(k[0], k[1], 0.18)
    PILLARS.append({"id": f"PL-{len(PILLARS)+1:02d}", "x": k[0], "z": k[1], "size": size, "top": round(top, 3), "ext": ext})
# pilares intermediários em vãos longos (>4,5 m) das paredes externas
for w in WALLS:
    if w["kind"] != "ext": continue
    l = L(w); n = int(l // 4.5)
    if n <= 0: continue
    parts = n + 1
    for i in range(1, parts):
        s = l * i / parts
        px_ = w["a"][0] + dirv(w)[0] * s; pz_ = w["a"][1] + dirv(w)[1] * s
        # evita colidir com aberturas
        bad = False
        for o in w["openings"]:
            if abs(o["center"] - s) < o["w"] / 2 + 0.3: bad = True
        if bad: continue
        top, _ = top_at(px_, pz_, 0.18)
        PILLARS.append({"id": f"PL-{len(PILLARS)+1:02d}", "x": round(px_, 3), "z": round(pz_, 3), "size": 0.25, "top": round(top, 3), "ext": True})

def scan_segments(poly, holes, axis_dir, spacing):
    """Gera segmentos de caibro paralelos à direção de queda (axis_dir = 'x' ou 'z') com espaçamento."""
    xs = [p[0] for p in poly]; zs = [p[1] for p in poly]
    segs = []
    if axis_dir == 'z':
        x = min(xs) + spacing / 2
        while x < max(xs):
            ev = []
            for p in [poly] + holes:
                n = len(p)
                for i in range(n):
                    x1, z1 = p[i]; x2, z2 = p[(i + 1) % n]
                    if (x1 > x) != (x2 > x):
                        ev.append(z1 + (x - x1) * (z2 - z1) / (x2 - x1))
            ev.sort()
            for j in range(0, len(ev) - 1, 2):
                if ev[j+1] - ev[j] > 0.3: segs.append(([round(x, 3), round(ev[j] + 0.05, 3)], [round(x, 3), round(ev[j+1] - 0.05, 3)]))
            x += spacing
    else:
        z = min(zs) + spacing / 2
        while z < max(zs):
            ev = []
            for p in [poly] + holes:
                n = len(p)
                for i in range(n):
                    x1, z1 = p[i]; x2, z2 = p[(i + 1) % n]
                    if (z1 > z) != (z2 > z):
                        ev.append(x1 + (z - z1) * (x2 - x1) / (z2 - z1))
            ev.sort()
            for j in range(0, len(ev) - 1, 2):
                if ev[j+1] - ev[j] > 0.3: segs.append(([round(ev[j] + 0.05, 3), round(z, 3)], [round(ev[j+1] - 0.05, 3), round(z, 3)]))
            z += spacing
    return segs

RAFTERS = []
for r in ROOFS:
    p = r["plane"]
    # direção de queda: a maior componente do gradiente
    along = 'z' if abs(p["gz"]) > abs(p["gx"]) else 'x'
    for a, b in scan_segments(r["polygon"], r["holes"], along, 0.90):
        RAFTERS.append({"roof": r["id"], "a": a, "b": b})

# --------------------------------------------------------------------------- mobiliário (sugestão visual)
def F(id, kind, room, x, z, w, d, h, rot=0, mat="madeira-clara", name=None, note="Sugestão visual (planta mobiliada)."):
    return {"id": id, "kind": kind, "room": room, "x": round(x, 3), "z": round(z, 3), "w": w, "d": d, "h": h, "rot": rot, "material": mat,
            "name": name or id, "src": "estimado", "note": note}
FURN = [
  # Quarto 2
  F("M-Q2-CAMA", "bed", "R-Q2", 1.20, 1.28, 1.00, 1.95, 0.55, 0, name="Cama (Quarto 2)"),
  F("M-Q2-CRIADO", "nightstand", "R-Q2", 0.62, 1.88, 0.40, 0.40, 0.45, 0, name="Criado-mudo (Quarto 2)"),
  F("M-Q2-ARM", "wardrobe", "R-Q2", 3.01, 1.35, 0.50, 1.90, 2.10, 270, name="Armário (Quarto 2)"),
  F("M-Q2-COM", "cabinet", "R-Q2", 0.60, 3.30, 0.60, 0.45, 0.80, 180, name="Cômoda (Quarto 2)"),
  # Banheiro social
  F("M-BS-VASO", "toilet", "R-BSOC", 1.40, 4.05, 0.38, 0.65, 0.40, 0, name="Vaso sanitário (social)", mat="louca"),
  F("M-BS-LAV", "basin", "R-BSOC", 1.95, 3.95, 0.50, 0.40, 0.85, 0, name="Lavatório (social)", mat="louca"),
  F("M-BS-BOX", "shower", "R-BSOC", 0.70, 4.45, 0.90, 0.90, 2.00, 0, name="Box com chuveiro (social)", mat="vidro"),
  # Quarto 3
  F("M-Q3-CAMA", "bed", "R-Q3", 0.78, 7.20, 0.90, 1.95, 0.50, 0, name="Cama de solteiro (Quarto 3)"),
  F("M-Q3-MESA", "desk", "R-Q3", 2.10, 7.80, 1.10, 0.60, 0.75, 0, name="Escrivaninha (escritório)"),
  F("M-Q3-CAD", "chair", "R-Q3", 1.95, 7.25, 0.45, 0.45, 0.90, 0, name="Cadeira (escritório)"),
  F("M-Q3-EST", "shelf", "R-Q3", 3.30, 8.85, 0.40, 1.20, 1.90, 270, name="Estante (escritório)"),
  # Hall
  F("M-HALL-BANCO", "bench", "R-HALL", 3.35, 11.60, 0.90, 0.38, 0.45, 0, name="Banco do hall"),
  F("M-HALL-JARD", "planter", "R-HALL", 2.50, 10.55, 0.30, 1.00, 0.45, 0, name="Jardineira (hall)", mat="madeira-escura"),
  # Sala
  F("M-SALA-SOFA", "sofaL", "R-SALA", 5.50, 2.20, 2.20, 3.00, 0.85, 0, name="Sofá em L", mat="tecido-claro"),
  F("M-SALA-TAPETE", "rug", "R-SALA", 5.55, 2.35, 2.90, 3.60, 0.015, 0, name="Tapete", mat="tecido-claro"),
  F("M-SALA-CENTRO", "roundtable", "R-SALA", 4.65, 2.60, 0.80, 0.80, 0.40, 0, name="Mesa de centro", mat="madeira-clara"),
  F("M-SALA-TV", "tvunit", "R-SALA", 3.72, 2.60, 0.40, 2.60, 0.55, 0, name="Painel de TV", mat="madeira-escura"),
  F("M-SALA-MESA", "table", "R-SALA", 8.00, 2.60, 1.00, 1.90, 0.76, 0, name="Mesa de jantar", mat="madeira-clara"),
  F("M-SALA-PEND1", "pendant", "R-SALA", 8.00, 2.05, 0.36, 0.36, 1.62, 0, name="Pendente sobre a mesa (1)", mat="preto", note="Inspirado nas imagens de referência (pendentes pretos sobre a mesa)."),
  F("M-SALA-PEND2", "pendant", "R-SALA", 8.00, 3.15, 0.36, 0.36, 1.62, 0, name="Pendente sobre a mesa (2)", mat="preto", note="Inspirado nas imagens de referência (pendentes pretos sobre a mesa)."),
  F("M-SALA-C1", "chair", "R-SALA", 7.35, 2.00, 0.42, 0.42, 0.90, 90, name="Cadeira de jantar 1"),
  F("M-SALA-C2", "chair", "R-SALA", 7.35, 2.60, 0.42, 0.42, 0.90, 90, name="Cadeira de jantar 2"),
  F("M-SALA-C3", "chair", "R-SALA", 7.35, 3.20, 0.42, 0.42, 0.90, 90, name="Cadeira de jantar 3"),
  F("M-SALA-C4", "chair", "R-SALA", 8.65, 2.00, 0.42, 0.42, 0.90, 270, name="Cadeira de jantar 4"),
  F("M-SALA-C5", "chair", "R-SALA", 8.65, 2.60, 0.42, 0.42, 0.90, 270, name="Cadeira de jantar 5"),
  F("M-SALA-C6", "chair", "R-SALA", 8.65, 3.20, 0.42, 0.42, 0.90, 270, name="Cadeira de jantar 6"),
  F("M-SALA-VASO", "plant", "R-SALA", 4.05, 0.70, 0.5, 0.5, 0.9, 0, name="Vaso de planta (sala)"),
  # Cozinha
  F("M-COZ-BANC", "counter", "R-COZ", 11.30, 0.60, 3.40, 0.62, 0.90, 0, name="Bancada com pia e cooktop", mat="bancada"),
  F("M-COZ-GEL", "fridge", "R-COZ", 9.70, 1.35, 0.75, 0.75, 1.80, 0, name="Geladeira", mat="inox"),
  F("M-COZ-ILHA", "counter", "R-COZ", 12.36, 2.85, 0.62, 1.50, 0.92, 0, name="Ilha da cozinha", mat="bancada"),
  F("M-COZ-BQ1", "stool", "R-COZ", 11.55, 3.90, 0.36, 0.36, 0.65, 0, name="Banqueta 1", mat="madeira-clara"),
  F("M-COZ-BQ2", "stool", "R-COZ", 12.15, 3.90, 0.36, 0.36, 0.65, 0, name="Banqueta 2", mat="madeira-clara"),
  F("M-COZ-BQ3", "stool", "R-COZ", 12.75, 3.90, 0.36, 0.36, 0.65, 0, name="Banqueta 3", mat="madeira-clara"),
  # Lavanderia
  F("M-LAV-TANQ", "tank", "R-LAV", 13.72, 0.58, 0.60, 0.55, 0.90, 0, name="Tanque", mat="inox"),
  F("M-LAV-MAQ", "washer", "R-LAV", 15.00, 0.62, 0.60, 0.60, 0.85, 0, name="Máquina de lavar", mat="branco"),
  F("M-LAV-ARM", "cabinet", "R-LAV", 15.05, 2.85, 0.80, 0.45, 0.90, 180, name="Armário baixo (lavanderia)"),
  # Banheiro da suíte
  F("M-BSU-BOX", "shower", "R-BSU", 13.78, 3.75, 0.90, 0.90, 2.00, 0, name="Box com chuveiro (suíte)", mat="vidro"),
  F("M-BSU-VASO", "toilet", "R-BSU", 14.60, 3.55, 0.38, 0.65, 0.40, 0, name="Vaso sanitário (suíte)", mat="louca"),
  F("M-BSU-LAV", "basin", "R-BSU", 15.20, 3.50, 0.55, 0.42, 0.85, 0, name="Lavatório (suíte)", mat="louca"),
  # Suíte
  F("M-SUI-CAMA", "bed", "R-SUI", 13.45, 8.70, 1.80, 2.10, 0.60, 180, name="Cama de casal (suíte)"),
  F("M-SUI-C1", "nightstand", "R-SUI", 12.20, 9.65, 0.45, 0.42, 0.50, 0, name="Criado-mudo esquerdo (suíte)"),
  F("M-SUI-C2", "nightstand", "R-SUI", 14.70, 9.65, 0.45, 0.42, 0.50, 0, name="Criado-mudo direito (suíte)"),
  F("M-SUI-ARM", "wardrobe", "R-SUI", 12.55, 4.78, 0.90, 0.55, 2.10, 0, name="Armário (suíte)"),
  F("M-SUI-TAPETE", "rug", "R-SUI", 13.45, 8.35, 2.60, 2.60, 0.015, 0, name="Tapete (suíte)", mat="tecido-claro"),
  # Pátio
  F("M-PAT-MESA", "roundtable", "R-PATIO", 7.47, 8.95, 1.10, 1.10, 0.70, 0, name="Mesa redonda (pátio)", mat="madeira-clara"),
  F("M-PAT-POL1", "armchair", "R-PATIO", 6.60, 9.15, 0.75, 0.80, 0.75, 80, name="Poltrona 1 (pátio)", mat="tecido-claro"),
  F("M-PAT-POL2", "armchair", "R-PATIO", 8.45, 9.15, 0.75, 0.80, 0.75, 280, name="Poltrona 2 (pátio)", mat="tecido-claro"),
  F("M-PAT-V1", "plant", "R-PATIO", 5.35, 9.65, 0.9, 0.9, 1.1, 0, name="Vaso de planta (pátio, oeste)"),
  F("M-PAT-V2", "plant", "R-PATIO", 10.30, 9.55, 1.0, 1.0, 1.3, 0, name="Vaso de planta (pátio, leste)"),
]

# --------------------------------------------------------------------------- instalações (ESQUEMÁTICAS)
def P(x, y, z): return [round(x, 3), round(y, 3), round(z, 3)]
def route(id, label, pts, r=0.022): return {"id": id, "label": label, "points": pts, "radius": r}
SYSTEMS = [
  {"id": "agua-fria", "name": "Água fria", "color": "#2f7fd6", "icon": "droplet", "stage": [0.00, 0.40],
   "routes": [
     route("AF-ENT", "Alimentação (cavalete leste)", [P(16.30, 0.30, 3.15), P(15.675, 0.30, 3.15)], 0.028),
     route("AF-BSU", "Ramal banheiro da suíte", [P(15.675, 0.30, 3.15), P(13.10, 0.30, 3.15)]),
     route("AF-LAV", "Ramal lavanderia e cozinha", [P(15.675, 0.30, 3.15), P(15.675, 0.30, 0.125), P(10.78, 0.30, 0.125)]),
     route("AF-W-ENT", "Alimentação oeste", [P(-0.30, 0.30, 3.75), P(0.125, 0.30, 3.75), P(2.00, 0.30, 3.75)]),
   ],
   "branches": [(15.20, 3.15), (14.60, 3.15), (13.78, 3.15), (15.00, 0.125), (13.72, 0.125), (10.78, 0.125), (0.70, 3.75), (1.40, 3.75), (1.95, 3.75)], "branchY": 0.30},
  {"id": "agua-quente", "name": "Água quente", "color": "#f08a24", "icon": "flame", "stage": [0.10, 0.50],
   "routes": [
     route("AQ-LAV", "Aquecedor → cozinha", [P(15.58, 0.42, 0.40), P(15.58, 0.42, 0.19), P(10.78, 0.42, 0.19)]),
     route("AQ-BSU", "Aquecedor → banheiro da suíte", [P(15.58, 0.42, 0.40), P(15.58, 0.42, 3.19), P(13.78, 0.42, 3.19)]),
     route("AQ-BSO", "Aquecedor → banheiro social", [P(0.30, 0.42, 3.60), P(0.30, 0.42, 3.79), P(1.95, 0.42, 3.79)]),
   ],
   "branches": [(10.78, 0.19), (13.78, 3.19), (15.20, 3.19), (0.70, 3.79), (1.95, 3.79)], "branchY": 0.42},
  {"id": "esgoto", "name": "Esgoto", "color": "#3f8f5b", "icon": "drain", "stage": [0.00, 0.35],
   "routes": [
     route("ES-COZ", "Cozinha → caixa de inspeção norte", [P(10.78, -0.30, 0.45), P(10.78, -0.30, -1.50)], 0.04),
     route("ES-LAV", "Lavanderia → caixa de inspeção norte", [P(15.00, -0.30, 0.62), P(13.72, -0.30, 0.62), P(13.72, -0.30, -1.50)], 0.04),
     route("ES-BSU", "Banheiro da suíte → caixa leste", [P(13.78, -0.30, 3.75), P(14.60, -0.30, 3.75), P(15.20, -0.30, 3.75), P(16.80, -0.30, 3.75)], 0.04),
     route("ES-BSO", "Banheiro social → caixa oeste", [P(1.95, -0.30, 3.95), P(1.40, -0.30, 4.05), P(0.70, -0.30, 4.45), P(-1.20, -0.30, 4.45)], 0.04),
   ],
   "branches": [], "branchY": -0.30,
   "devices": [
     {"id": "CI-N1", "kind": "manhole", "pos": [10.78, -0.45, -1.50], "label": "Caixa de inspeção (cozinha)"},
     {"id": "CI-N2", "kind": "manhole", "pos": [13.72, -0.45, -1.50], "label": "Caixa de inspeção (lavanderia)"},
     {"id": "CI-L", "kind": "manhole", "pos": [16.80, -0.45, 3.75], "label": "Caixa de inspeção (suíte)"},
     {"id": "CI-O", "kind": "manhole", "pos": [-1.20, -0.45, 4.45], "label": "Caixa de inspeção (social)"},
   ]},
  {"id": "eletrica", "name": "Elétrica", "color": "#e8c21a", "icon": "bolt", "stage": [0.20, 0.70],
   "routes": [
     route("EL-QD", "Quadro → circuito social", [P(3.20, 1.40, 9.50), P(3.20, 2.55, 9.50), P(3.61, 2.55, 9.50), P(3.61, 2.55, 3.75), P(3.40, 2.55, 3.75), P(3.40, 2.55, 0.125), P(13.10, 2.55, 0.125)], 0.02),
     route("EL-OESTE", "Circuito ala oeste", [P(3.40, 2.55, 3.75), P(0.125, 2.55, 3.75), P(0.125, 2.55, 9.50)], 0.02),
     route("EL-LESTE", "Circuito ala leste e suíte", [P(13.10, 2.55, 0.125), P(15.675, 2.55, 0.125), P(15.675, 2.55, 10.225), P(11.15, 2.55, 10.225)], 0.02),
   ],
   "branches": [], "branchY": 2.55,
   "devices": [
     {"id": "QD", "kind": "panel", "pos": [3.20, 1.40, 9.425], "label": "Quadro de distribuição"},
   ]},
  {"id": "clima", "name": "Climatização", "color": "#38bdd0", "icon": "wind", "stage": [0.40, 0.90],
   "routes": [
     route("CL-SALA", "Linha frigorígena — sala", [P(5.80, 2.40, 0.20), P(5.80, 2.40, -0.55)], 0.03),
     route("CL-Q2", "Linha frigorígena — Quarto 2", [P(1.70, 2.30, 0.20), P(1.70, 2.30, -0.55)], 0.03),
     route("CL-SUI", "Linha frigorígena — suíte", [P(11.90, 2.30, 10.10), P(11.90, 2.30, 10.90)], 0.03),
   ],
   "branches": [], "branchY": 2.4,
   "devices": [
     {"id": "SP-SALA", "kind": "split", "pos": [5.80, 2.40, 0.40], "label": "Split da sala", "rot": 0},
     {"id": "SP-Q2", "kind": "split", "pos": [1.70, 2.30, 0.40], "label": "Split do Quarto 2", "rot": 0},
     {"id": "SP-SUI", "kind": "split", "pos": [11.90, 2.30, 10.00], "label": "Split da suíte", "rot": 180},
     {"id": "CD-SALA", "kind": "condenser", "pos": [5.80, 0.30, -0.80], "label": "Condensadora (sala)", "rot": 0},
     {"id": "CD-Q2", "kind": "condenser", "pos": [1.70, 0.30, -0.80], "label": "Condensadora (Quarto 2)", "rot": 0},
     {"id": "CD-SUI", "kind": "condenser", "pos": [11.90, 0.30, 11.10], "label": "Condensadora (suíte)", "rot": 180},
   ]},
]
# luminárias ilustrativas (centro dos ambientes, sob o forro)
LIGHTS = []
for r in ROOMS:
    if r.get("open"): continue
    xs = [p[0] for p in r["polygon"]]; zs = [p[1] for p in r["polygon"]]
    cxm, czm = (min(xs)+max(xs))/2, (min(zs)+max(zs))/2
    if not pip(r["polygon"], cxm, czm): cxm, czm = r["spot"][0], r["spot"][1]
    top, _ = top_at(cxm, czm, 0.0)
    LIGHTS.append({"id": f"LZ-{r['id'][2:]}", "room": r["id"], "x": round(cxm, 3), "z": round(czm, 3), "y": round(top - 0.04, 3)})

# --------------------------------------------------------------------------- revestimentos de madeira (acabamento)
CLAD = [
  {"id": "RV-HALL-S", "name": "Revestimento em ripas verticais — hall (sul)", "wall": "P-HS", "side": -1, "from": 0.0, "to": "L", "y0": 0.0, "y1": "top", "orientation": "vertical"},
  {"id": "RV-HALL-O", "name": "Revestimento em ripas verticais — hall (oeste)", "wall": "P-HO", "side": -1, "from": 0.0, "to": "L", "y0": 0.0, "y1": "top", "orientation": "vertical"},
  {"id": "RV-HALL-L", "name": "Revestimento em ripas verticais — hall (leste)", "wall": "P-PO", "side": -1, "from": 4.1, "to": "L", "y0": 0.0, "y1": "top", "orientation": "vertical"},
  {"id": "RV-VID-S", "name": "Friso de madeira acima do vidro (lado do pátio)", "wall": "P-VID", "side": 1, "from": 0.10, "to": "L-0.20", "y0": 2.50, "y1": "top", "orientation": "horizontal"},
]

# --------------------------------------------------------------------------- paisagismo (estimado / ilustrativo)
import random
# canteiros retangulares [x0, z0, x1, z1] (m) — posições lidas das imagens de referência (estimado)
BEDS = [
  {"id": "CT-FRENTE-ESQ", "name": "Canteiro frontal esquerdo", "rect": [-1.1, 9.7, 2.0, 11.0]},
  {"id": "CT-OESTE", "name": "Canteiro lateral oeste", "rect": [-1.1, 0.6, -0.2, 9.7]},
  {"id": "CT-FRENTE-PATIO", "name": "Canteiro frontal do pátio", "rect": [4.9, 10.7, 11.3, 12.0]},
  {"id": "CT-FRENTE-SUITE", "name": "Canteiro frontal da suíte", "rect": [11.5, 10.45, 16.9, 11.6]},
  {"id": "CT-LESTE", "name": "Canteiro lateral leste", "rect": [15.9, 0.8, 16.9, 10.45]},
  {"id": "CT-PATIO", "name": "Canteiro interno do pátio", "rect": [9.2, 8.6, 10.95, 9.95]},
]
for bd in BEDS:
    x0, z0, x1, z1 = bd["rect"]
    bd["polygon"] = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
    del bd["rect"]
TREES = [(-0.55, 10.35, 1.0), (16.35, 11.0, 1.05), (10.35, 9.25, 0.9), (16.4, 1.7, 1.1), (-0.65, 1.6, 1.0)]
PLANTS = []
_rnd = random.Random(20260701)
for t in TREES:
    PLANTS.append({"x": t[0], "z": t[1], "kind": "arvore", "s": t[2]})
for bd in BEDS:
    xs = [q[0] for q in bd["polygon"]]; zs = [q[1] for q in bd["polygon"]]
    x0, x1, z0, z1 = min(xs) + 0.22, max(xs) - 0.22, min(zs) + 0.22, max(zs) - 0.22
    n = int((x1 - x0) * (z1 - z0) * 2.2)
    placed = []
    tries = 0
    while len(placed) < n and tries < 900:
        tries += 1
        x, z = _rnd.uniform(x0, x1), _rnd.uniform(z0, z1)
        if any(math.hypot(x - t[0], z - t[1]) < 0.75 for t in TREES): continue
        if any(math.hypot(x - q[0], z - q[1]) < 0.52 * (q[2] + 0.2) for q in placed): continue
        kind = "graminea" if _rnd.random() < 0.28 else "arbusto"
        s_ = round(_rnd.uniform(0.6, 1.0) if kind == "graminea" else _rnd.uniform(0.7, 1.3), 2)
        placed.append((round(x, 2), round(z, 2), s_, kind))
    for x, z, s_, kind in placed:
        PLANTS.append({"x": x, "z": z, "kind": kind, "s": s_})
PATHS = [
  {"id": "CAM-ENTRADA", "name": "Calçada de acesso ao hall", "polygon": [[3.05, 12.20], [4.05, 12.20], [4.05, 17.5], [3.05, 17.5]], "material": "concreto-claro"},
  {"id": "PLAT-FRENTE", "name": "Piso externo frontal", "polygon": [[-1.5, 12.2], [5.2, 12.2], [5.2, 14.0], [-1.5, 14.0]], "material": "concreto-claro"},
  {"id": "GARAGEM", "name": "Área de manobra / garagem", "polygon": [[-11.0, 14.0], [5.2, 14.0], [5.2, 24.0], [-11.0, 24.0]], "material": "concreto-garagem"},
]

# --------------------------------------------------------------------------- legendas
ANNOT = [
  {"id": "AN-FUND", "text": "Sapata corrida", "layer": "fundacao", "at": [7.9, -0.35, 12.2 + 0.3], "stage": 0, "element": None},
  {"id": "AN-RADIER", "text": "Radier (laje de piso)", "layer": "fundacao", "at": [7.9, -0.07, 2.6], "stage": 0, "element": None},
  {"id": "AN-PIL", "text": "Pilar de concreto (esquemático)", "layer": "estrutura", "at": [15.675, 1.8, 0.125], "stage": 1, "element": None},
  {"id": "AN-CINTA", "text": "Cinta superior", "layer": "estrutura", "at": [9.4, 4.6, 0.125], "stage": 1, "element": None},
  {"id": "AN-CAIBRO", "text": "Caibros / estrutura da cobertura", "layer": "estrutura", "at": [7.0, 4.2, 2.8], "stage": 1, "element": None},
  {"id": "AN-AF", "text": "Água fria", "layer": "instalacoes", "at": [14.3, 0.32, 3.15], "stage": 2, "element": None},
  {"id": "AN-ES", "text": "Esgoto", "layer": "instalacoes", "at": [10.78, -0.30, -0.9], "stage": 2, "element": None},
  {"id": "AN-EL", "text": "Elétrica (circuito ilustrativo)", "layer": "instalacoes", "at": [6.5, 2.55, 0.125], "stage": 2, "element": None},
  {"id": "AN-QD", "text": "Quadro de distribuição", "layer": "instalacoes", "at": [3.20, 1.40, 9.425], "stage": 2, "element": None},
  {"id": "AN-PAREDE", "text": "Alvenaria com reboco", "layer": "alvenaria", "at": [15.675, 2.0, 5.0], "stage": 3, "element": "P-L"},
  {"id": "AN-VIDRO", "text": "Esquadria de correr — sala/pátio", "layer": "esquadrias", "at": [7.9, 1.2, 5.50], "stage": 3, "element": None},
  {"id": "AN-COB", "text": "Cobertura metálica (uma água)", "layer": "cobertura", "at": [8.0, 4.0, 1.5], "stage": 3, "element": None},
  {"id": "AN-CUM", "text": "Cumeeira — ponto mais alto (4,90 m)", "layer": "cobertura", "at": [8.0, 4.9, 0.0], "stage": 3, "element": None},
  {"id": "AN-ENT", "text": "Porta de entrada em madeira", "layer": "esquadrias", "at": [3.95, 1.1, 12.2], "stage": 3, "element": None},
  {"id": "AN-PATIO", "text": "Pátio / varanda central (descoberto)", "layer": "acabamentos", "at": [7.9, 0.05, 8.0], "stage": 4, "element": None},
  {"id": "AN-SOFA", "text": "Sofá em L (sugestão)", "layer": "mobiliario", "at": [5.5, 0.9, 2.2], "stage": 4, "element": "M-SALA-SOFA"},
]

# --------------------------------------------------------------------------- escrita
house = {
  "version": 1,
  "meta": {
    "name": "Casa de campo térrea em U — Raio-X Arquitetônico",
    "units": "m", "unitsScale": 1,
    "origin": "Canto noroeste externo da casa. X = leste, Z = sul (frente), Y = altura. Norte = −Z.",
    "source": "Planta baixa, fachadas, planta de cobertura e planta mobiliada geradas por IA a partir de uma foto de referência (arquivos em public/assets).",
    "disclaimer": "Visualização arquitetônica. Elementos não documentados são estimativos.",
    "orientation": "Frente (sul) = fachada com a porta de entrada; fundos = norte; lateral direita = leste (suíte).",
  },
  "reference": {
    "image": "assets/planta.png", "furnished": "assets/planta-mobiliada.png", "roof": "assets/cobertura.png",
    "sizePx": [1448, 1086], "originPx": [122, 122], "mPerPx": [round(SX, 6), round(SZ, 6)],
    "note": "O desenho possui escalas diferentes em X e Z (≈76,3 px/m × ≈62,8 px/m) para respeitar as cotas totais 15,80 × 12,20 m.",
  },
  "params": PARAMS,
  "levels": [{"id": "terreo", "name": "Térreo", "elevation": 0.0}],
  "walls": WALLS,
  "rooms": ROOMS,
  "roofs": ROOFS,
  "roofExtras": {
    "skylight": {"id": "CL-1", "name": "Claraboia (planta de cobertura)", "center": [4.11, 9.0], "size": [0.62, 0.90], "src": "confirmado",
                  "note": "Posição lida da planta de cobertura; ajustada para a faixa de ligação entre a circulação e o hall."},
    "chimney": {"id": "CH-1", "name": "Chaminé / duto (planta de cobertura)", "pos": [4.43, 2.28], "radius": 0.10, "height": 0.9, "src": "estimado",
                "note": "Círculo escuro na planta de cobertura; função não documentada (provável chaminé/exaustão)."},
  },
  "structure": {
    "system": "Concreto armado ilustrativo: pilares + cinta superior + baldrame; cobertura em madeira/metal.",
    "note": "ESQUEMÁTICO. A planta arquitetônica não traz projeto estrutural; dimensões e posições são ilustrativas.",
    "pillars": PILLARS, "rafters": RAFTERS,
  },
  "slab": {"name": "Radier (laje de piso)", "polygon": [[0, 0], [15.80, 0], [15.80, 10.35], [4.705, 10.35], [4.705, 12.20], [2.04, 12.20], [2.04, 9.625], [0, 9.625]], "src": "esquematico",
           "note": "ESQUEMÁTICO: laje de piso (radier) sobre toda a pegada da casa e do pátio."},
  "furniture": FURN,
  "lights": LIGHTS,
  "systems": SYSTEMS,
  "cladding": CLAD,
  "landscape": {"beds": BEDS, "plants": PLANTS, "paths": PATHS},
  "annotations": ANNOT,
  "assumptions": [
    {"id": "H-01", "text": "Pé-direito de 2,80 m e cumeeira máxima de 4,90 m foram lidos das cotas das quatro fachadas (confirmado), mas a altura de cada trecho de parede é calculada pelo plano do telhado (estimado)."},
    {"id": "H-02", "text": "Espessuras de parede: 25 cm externas, 12–15 cm internas (estimadas; o desenho exagera a espessura)."},
    {"id": "H-03", "text": "Desenho da planta tem escala diferente em X e Z. Mantive as cotas totais (15,80 × 12,20 m) e as posições do desenho; a imagem de referência usa duas escalas."},
    {"id": "H-04", "text": "Cotas internas das salas e quartos (ex.: lavanderia 2,60 × 2,10 m) divergem do desenho em até ~0,8 m. O modelo segue as posições das paredes no desenho; a cota nominal aparece ao lado da área calculada."},
    {"id": "H-05", "text": "A soma das cotas laterais esquerdas (3,20 + 1,70 + 3,10 + 2,00 = 10,00 m) não fecha com a cota total de 12,20 m. Prevaleceu a cota total."},
    {"id": "H-06", "text": "O hall de entrada não tem passagem desenhada para o restante da casa. Foi incluída uma porta ESTIMADA (0,80 m) na parede hall → circulação para permitir a navegação."},
    {"id": "H-07", "text": "Inclinações: a planta de cobertura indica 10% em todos os planos; o volume central usa ≈17% (ficha: 8–10°) para chegar à cota de 4,90 m. Ajustável em Parâmetros."},
    {"id": "H-08", "text": "Fundação (sapata corrida + radier), pilares, cintas e caibros são ESQUEMÁTICOS — nada disso consta da planta."},
    {"id": "H-09", "text": "Instalações (água fria/quente, esgoto, elétrica, climatização) são trajetos ESQUEMÁTICOS para demonstrar o recurso; sem bitolas, cargas ou vazões."},
    {"id": "H-10", "text": "Mobiliário e louças seguem a planta mobiliada (posições aproximadas), em geometria simples; é sugestão visual."},
    {"id": "H-11", "text": "Alturas de peitoril/vergas das janelas foram lidas das fachadas quando possível; as demais são estimadas."},
    {"id": "H-12", "text": "Muro baixo do pátio (1,10 m), paisagismo e piso externo vêm da ficha e das fachadas — não estão na planta baixa."},
  ],
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(house, f, ensure_ascii=False, indent=1)
print("OK ->", OUT, "| paredes:", len(WALLS), "| pilares:", len(PILLARS), "| caibros:", len(RAFTERS), "| móveis:", len(FURN))
