#!/usr/bin/env python3
"""Europe map from Natural Earth (world-atlas 50m) -> a TS data module.

Lambert azimuthal equal-area projection centred on Europe, rings clipped to the
frame, simplified, with the 27 EU member states flagged. Output:
components/europeMapData.ts
"""
import json, math, sys

SRC, OUT = sys.argv[1], sys.argv[2]
W, H = 1000, 780
LON0, LAT0 = 14.0, 50.0
EU = {'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czechia', 'Denmark', 'Estonia', 'Finland', 'France',
      'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands',
      'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden'}
NEIGHBOURS = {'United Kingdom', 'Norway', 'Iceland', 'Switzerland', 'Serbia', 'Bosnia and Herz.', 'Montenegro', 'Albania',
              'Macedonia', 'Kosovo', 'Moldova', 'Ukraine', 'Belarus', 'Russia', 'Turkey', 'Morocco', 'Algeria', 'Tunisia',
              'Libya', 'Syria', 'Georgia', 'N. Cyprus', 'Lebanon', 'Andorra', 'Liechtenstein', 'Monaco', 'San Marino',
              'Vatican', 'Faeroe Is.', 'Isle of Man', 'Jersey', 'Guernsey', 'Gibraltar', 'Åland'}

topo = json.load(open(SRC))
sx, sy = topo['transform']['scale']
tx, ty = topo['transform']['translate']
arcs = []
for arc in topo['arcs']:
    x = y = 0
    pts = []
    for dx, dy in arc:
        x += dx; y += dy
        pts.append((x * sx + tx, y * sy + ty))
    arcs.append(pts)


def arc_pts(i):
    return arcs[i] if i >= 0 else arcs[~i][::-1]


def ring(arc_ids):
    pts = []
    for i in arc_ids:
        a = arc_pts(i)
        pts.extend(a if not pts else a[1:])
    return pts


def project(lon, lat):
    l, p = math.radians(lon - LON0), math.radians(lat)
    p0 = math.radians(LAT0)
    k = math.sqrt(2 / (1 + math.sin(p0) * math.sin(p) + math.cos(p0) * math.cos(p) * math.cos(l)))
    return k * math.cos(p) * math.sin(l), k * (math.cos(p0) * math.sin(p) - math.sin(p0) * math.cos(p) * math.cos(l))


# scale so that Europe fills the frame: fit lon -11..36 at lat 36..70 roughly
S = 0
for lon, lat in ((-11, 50), (34, 50), (12, 36), (12, 70)):
    x, y = project(lon, lat)
SCALE = 1150.0
CX, CY = W / 2, H / 2 + 40


def to_xy(lon, lat):
    x, y = project(lon, lat)
    return CX + SCALE * x, CY - SCALE * y


def clip(poly, rect):
    x0, y0, x1, y1 = rect
    def run(pts, inside, inter):
        out = []
        for i, cur in enumerate(pts):
            prev = pts[i - 1]
            if inside(cur):
                if not inside(prev):
                    out.append(inter(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(inter(prev, cur))
        return out
    def ix(xc):
        return lambda a, b: (xc, a[1] + (b[1] - a[1]) * (xc - a[0]) / (b[0] - a[0]))
    def iy(yc):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (yc - a[1]) / (b[1] - a[1]), yc)
    pts = poly
    for inside, inter in (
        (lambda p: p[0] >= x0, ix(x0)), (lambda p: p[0] <= x1, ix(x1)),
        (lambda p: p[1] >= y0, iy(y0)), (lambda p: p[1] <= y1, iy(y1)),
    ):
        if not pts:
            return []
        pts = run(pts, inside, inter)
    return pts


def simplify(pts, tol):
    if len(pts) < 3:
        return pts
    def dist(p, a, b):
        (x, y), (x1, y1), (x2, y2) = p, a, b
        dx, dy = x2 - x1, y2 - y1
        if dx == dy == 0:
            return math.hypot(x - x1, y - y1)
        t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
        return math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        dmax, idx = 0, -1
        for i in range(a + 1, b):
            d = dist(pts[i], pts[a], pts[b])
            if d > dmax:
                dmax, idx = d, i
        if dmax > tol:
            keep[idx] = True
            stack.append((a, idx)); stack.append((idx, b))
    return [p for p, k in zip(pts, keep) if k]


def polys(geom):
    if geom['type'] == 'Polygon':
        return [geom['arcs']]
    return geom['arcs']


rect = (-40, -40, W + 40, H + 40)
out = []
for g in topo['objects']['countries']['geometries']:
    name = g['properties']['name']
    if name not in EU and name not in NEIGHBOURS:
        continue
    d = []
    for poly in polys(g):
        for r_i, r in enumerate(poly):
            pts = [to_xy(lon, lat) for lon, lat in ring(r)]
            pts = clip(pts, rect)
            if len(pts) < 3:
                continue
            pts = simplify(pts, 0.55)
            if len(pts) < 3:
                continue
            xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
            if (max(xs) - min(xs)) * (max(ys) - min(ys)) < 1.6 and name not in ('Malta', 'Luxembourg', 'Cyprus'):
                continue
            d.append('M' + 'L'.join('%.1f %.1f' % p for p in pts) + 'Z')
    if d:
        out.append({'name': name, 'eu': name in EU, 'hl': name == 'Belarus', 'd': ''.join(d)})

cities = {'Berlin': (13.405, 52.52), 'Paris': (2.35, 48.86), 'Madrid': (-3.70, 40.42), 'Rome': (12.50, 41.90),
          'Stockholm': (18.07, 59.33), 'Warsaw': (21.01, 52.23), 'Lisbon': (-9.14, 38.72), 'Athens': (23.73, 37.98),
          'Dublin': (-6.26, 53.35), 'Minsk': (27.56, 53.90), 'Helsinki': (24.94, 60.17), 'Vienna': (16.37, 48.21), 'Amsterdam': (4.90, 52.37)}
pts = {k: tuple(round(v, 1) for v in to_xy(*c)) for k, c in cities.items()}

ts = ['/* Generated by scripts/build-europe-map.py from Natural Earth (world-atlas 50m). Do not edit by hand. */',
      'export interface MapCountry { name: string; eu: boolean; hl: boolean; d: string }',
      f'export const EUROPE_VIEWBOX = "0 0 {W} {H}";',
      'export const EUROPE_COUNTRIES: MapCountry[] = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';',
      'export const EUROPE_CITIES: Record<string, [number, number]> = ' + json.dumps(pts, separators=(',', ':')) + ';', '']
open(OUT, 'w').write('\n'.join(ts))
tot = sum(len(c['d']) for c in out)
print('countries', len(out), 'eu', sum(c['eu'] for c in out), 'bytes', tot)
print(pts)
