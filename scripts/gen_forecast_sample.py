"""Generates src/data/forecast.sample.json: SAMPLE forecast data for UI development only.

Not the COA forecast algorithm. Each recently reported, still-running train is projected
station by station in its direction using the median observed running time between
those two stations in the snapshot; standing trains depart 2 minutes after "now".
"""
import json, os, statistics
from datetime import datetime, timedelta

D = r'D:/coa_chart/src/data'
FMT = '%d-%m-%y %H:%M:%S'


def load(name):
    return json.load(open(os.path.join(D, name), encoding='utf-8-sig'))


def p(s):
    if not s:
        return None
    return datetime.strptime(s if len(s) > 14 else s + ':00', FMT)


NOW = datetime(2026, 9, 21, 0, 25, 0)
HORIZON = NOW + timedelta(hours=2)
PAST = NOW - timedelta(minutes=120)

board = load('BoardDetails.json')
order = sorted(board, key=lambda r: (r['MANDSPLSQNC'], r['MANSTTNSQNC']))
stations = [(r['MANDSPLNUMB'], r['MAVSTTNCODE']) for r in order]
index = {s: i for i, s in enumerate(stations)}

movement = load('movement.json')
trains = {}
for r in movement:
    trains.setdefault(r['TRINID'], []).append(r)
for rows in trains.values():
    rows.sort(key=lambda r: r['SEQNO'])

# Median running time between adjacent board stations, by ordered pair.
runs = {}
for rows in trains.values():
    for a, b in zip(rows, rows[1:]):
        sa, sb = (a['SUBSCTNID'], a['STTNCODE']), (b['SUBSCTNID'], b['STTNCODE'])
        if sa not in index or sb not in index or abs(index[sa] - index[sb]) != 1:
            continue
        dep, arr = p(a['DPRTTIME']), p(b['DPRTARVLTIME'])
        if dep and arr and timedelta(0) < arr - dep < timedelta(hours=1):
            runs.setdefault((sa, sb), []).append((arr - dep).total_seconds())
median = {k: statistics.median(v) for k, v in runs.items()}

out = []
for tid, rows in trains.items():
    last = rows[-1]
    sl = (last['SUBSCTNID'], last['STTNCODE'])
    if sl not in index or last['DESTNFLAG'] == 'Y' or last['DIRECTION'] not in ('UP', 'DN'):
        continue
    arr, dep = p(last['DPRTARVLTIME']), p(last['DPRTTIME'])
    reported = dep or arr
    if not reported or not (PAST <= reported <= NOW):
        continue
    step = 1 if last['DIRECTION'] == 'DN' else -1
    points = []
    t = dep
    if t is None:
        t = max(NOW, arr) + timedelta(minutes=2)
        points.append({'station': last['STTNCODE'], 'section': last['SUBSCTNID'], 'departure': t.strftime(FMT)})
    i = index[sl]
    while True:
        j = i + step
        if j < 0 or j >= len(stations) or stations[j][0] != stations[i][0]:
            break
        run = median.get((stations[i], stations[j]))
        if run is None:
            break
        t = t + timedelta(seconds=run)
        if t > HORIZON:
            break
        points.append({'station': stations[j][1], 'section': stations[j][0], 'arrival': t.strftime(FMT), 'departure': t.strftime(FMT)})
        i = j
    if points:
        out.append({'trainId': tid, 'points': points})

doc = {
    'note': 'SAMPLE forecast for UI development only. Not produced by the COA forecast algorithm: '
            'trains are projected using median observed running times from the supplied snapshot.',
    'generatedFor': NOW.strftime(FMT),
    'trains': out,
}
with open(os.path.join(D, 'forecast.sample.json'), 'w', encoding='utf-8') as f:
    json.dump(doc, f, indent=1)
print('trains', len(out), 'points', sum(len(t['points']) for t in out), 'pairs with medians', len(median))
