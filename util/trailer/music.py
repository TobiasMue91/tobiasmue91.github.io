"""Step 3: the trailer's soundtrack, synthesised from nothing: 120 BPM in A minor, cut to plan.json.

A clock ticks through the intro and the ending (the time travel tab's stopwatch), the
slider clicks through every day it passes, every version of the snake plays a note, and
every era, wipe, review and number lands on a hit. Writes build/soundtrack.wav (48 kHz
stereo). Needs numpy and scipy.
"""
import json
import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, fftconvolve

HERE = Path(__file__).resolve().parent
BUILD = HERE / 'build'
SR = 48000
plan = json.loads((BUILD / 'plan.json').read_text())
DUR = plan['duration']
N = int(SR * DUR)
rng = np.random.default_rng(7)

# Busses: dry drums, music (sent to reverb), fx (sent to reverb)
bus = {name: np.zeros((2, N)) for name in ('drums', 'music', 'fx', 'dry')}


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(name, t, sig, gain=1.0, pan=0.0):
    """Mix a mono signal into a bus at time t (s), equal-power pan -1..1."""
    i = int(round(t * SR))
    if i >= N or len(sig) == 0:
        return
    if i < 0:
        sig = sig[-i:]
        i = 0
    sig = sig[:N - i]
    a = (pan + 1) * np.pi / 4
    bus[name][0, i:i + len(sig)] += sig * gain * np.cos(a)
    bus[name][1, i:i + len(sig)] += sig * gain * np.sin(a)


def phase(freq, n):
    f = np.broadcast_to(np.asarray(freq, dtype=float), (n,))
    return np.cumsum(f / SR) % 1.0, f / SR


def blep(ph, dt):
    y = np.zeros_like(ph)
    m = ph < dt
    x = ph[m] / dt[m]
    y[m] = x + x - x * x - 1
    m = ph > 1 - dt
    x = (ph[m] - 1) / dt[m]
    y[m] = x * x + x + x + 1
    return y


def saw(freq, n):
    ph, dt = phase(freq, n)
    return 2 * ph - 1 - blep(ph, dt)


def square(freq, n, duty=0.5):
    ph, dt = phase(freq, n)
    ph2 = (ph + (1 - duty)) % 1.0
    return (2 * ph - 1 - blep(ph, dt)) - (2 * ph2 - 1 - blep(ph2, dt))


def tri(freq, n):
    ph, _ = phase(freq, n)
    return 4 * np.abs(ph - 0.5) - 1


def sine(freq, n):
    ph, _ = phase(freq, n)
    return np.sin(2 * np.pi * ph)


def noise(n):
    return rng.uniform(-1, 1, n)


def env(n, a=0.005, d=0.1, s=0.0, r=0.05, hold=None):
    """ADSR over n samples; the release starts at hold (s) or at the end minus r."""
    t = np.arange(n) / SR
    hold = (n / SR - r) if hold is None else hold
    e = np.where(t < a, t / max(a, 1e-6), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-6)))
    rel = t > hold
    if rel.any():
        at = e[np.argmax(rel)] if rel.any() else 0
        e[rel] = at * np.maximum(0, 1 - (t[rel] - hold) / max(r, 1e-6))
    return e


def lp(x, f, order=2):
    return sosfilt(butter(order, min(f, SR * 0.45), 'low', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, 'high', fs=SR, output='sos'), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, min(hi, SR * 0.45)], 'band', fs=SR, output='sos'), x)


def sweep_lp(x, f0, f1, block=256, kind='low', q_width=0.5):
    """A filter whose cutoff glides exponentially from f0 to f1 over the signal."""
    out = np.zeros_like(x)
    n = len(x)
    zi = None
    for s in range(0, n, block):
        f = f0 * (f1 / f0) ** (s / max(n - 1, 1))
        if kind == 'low':
            sos = butter(2, min(f, SR * 0.45), 'low', fs=SR, output='sos')
        else:
            lo, hi = f * (1 - q_width / 2), min(f * (1 + q_width / 2), SR * 0.45)
            sos = butter(1, [lo, hi], 'band', fs=SR, output='sos')
        if zi is None or zi.shape[0] != sos.shape[0]:
            zi = np.zeros((sos.shape[0], 2))
        out[s:s + block], zi = sosfilt(sos, x[s:s + block], zi=zi)
    return out


def secs(d):
    return int(d * SR)


# ---- instruments -------------------------------------------------------------------

def kick(t, g=1.0):
    n = secs(0.45)
    tt = np.arange(n) / SR
    f = 50 + 110 * np.exp(-tt * 30)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 8.5) * 0.85
    click = lp(noise(n), 3000) * np.exp(-tt * 250) * 0.5
    add('drums', t, np.tanh(1.6 * (body + click)) * g)


def clap(t, g=1.0):
    n = secs(0.3)
    tt = np.arange(n) / SR
    e = np.zeros(n)
    for k, off in enumerate((0, 0.011, 0.022)):
        m = tt >= off
        e[m] += np.exp(-(tt[m] - off) * (200 if k < 2 else 22))
    s = bp(noise(n), 900, 5000) * e + 0.25 * sine(190, n) * np.exp(-tt * 30)
    add('drums', t, s * g * 0.8, pan=0.0)
    add('fx', t, s * g * 0.25)


def hat(t, g=1.0, open_=False, pan=0.25):
    n = secs(0.25 if open_ else 0.06)
    tt = np.arange(n) / SR
    s = hp(noise(n), 7500) * np.exp(-tt * (14 if open_ else 70))
    add('drums', t, s * g * 0.45, pan=pan)


def snare(t, g=1.0):
    n = secs(0.18)
    tt = np.arange(n) / SR
    s = bp(noise(n), 1200, 7000) * np.exp(-tt * 26) + 0.4 * tri(200, n) * np.exp(-tt * 40)
    add('drums', t, s * g * 0.6)
    add('fx', t, s * g * 0.15)


def crash(t, g=1.0, dur=2.2):
    n = secs(dur)
    tt = np.arange(n) / SR
    metal = sum(square(f, n, 0.5) for f in (540, 800, 1170, 1623, 2250)) / 5
    s = hp(noise(n) * 0.8 + metal * 0.2, 4000) * np.exp(-tt * 2.2)
    add('drums', t, s * g * 0.35, pan=-0.2)
    add('fx', t, s * g * 0.2, pan=0.2)


def boom(t, g=1.0, dur=2.5):
    n = secs(dur)
    tt = np.arange(n) / SR
    f = 42 + 50 * np.exp(-tt * 3)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 2.2) * 0.75
    s += lp(noise(n), 400) * np.exp(-tt * 5) * 0.6
    add('dry', t, np.tanh(s * 1.4) * g * 0.9)
    add('fx', t, lp(noise(n), 1500) * np.exp(-tt * 3) * g * 0.25)


def tick(t, g=1.0, tock=False):
    n = secs(0.05)
    tt = np.arange(n) / SR
    f = 2300 if tock else 3000
    s = sine(f, n) * np.exp(-tt * 900) + bp(noise(n), 2500, 9000) * np.exp(-tt * 1400) * 0.8
    s += sine(f / 3, n) * np.exp(-tt * 300) * 0.4
    add('dry', t, s * g * 0.55, pan=-0.15 if tock else 0.15)
    add('fx', t, s * g * 0.12)


def click(t, g=1.0, pitch=1.0):
    n = secs(0.012)
    tt = np.arange(n) / SR
    s = sine(4200 * pitch, n) * np.exp(-tt * 1500) + hp(noise(n), 5000) * np.exp(-tt * 2500) * 0.5
    add('dry', t, s * g * 0.18)


def blip(t, m, g=1.0, dur=0.16):
    n = secs(dur)
    s = square(mtof(m), n, 0.25) * env(n, 0.002, 0.07, 0.0, 0.02)
    s = lp(s, 5000)
    add('music', t, s * g * 0.22, pan=0.1)


def pad(t, notes, dur, g=1.0, cutoff=1400, attack=0.35, release=0.9):
    n = secs(dur + release)
    total = np.zeros(n)
    for m in notes:
        for det in (-0.09, 0.0, 0.08):
            total += saw(mtof(m + det), n)
    total /= 3 * len(notes)
    total = lp(total, cutoff, 2)
    total *= env(n, attack, 5.0, 1.0, release, hold=dur)
    add('music', t, total * g * 0.9, pan=-0.3)
    add('music', t + 0.013, total * g * 0.9, pan=0.3)


def bass(t, m, dur, g=1.0, cutoff=700):
    n = secs(dur)
    tt = np.arange(n) / SR
    s = saw(mtof(m + 12), n) * 0.6 + sine(mtof(m), n) * 0.6
    s = lp(s, cutoff * 1.6) * env(n, 0.004, 0.18, 0.55, 0.03)
    add('dry', t, s * g * 0.5)


def pluck(t, m, g=1.0, dur=0.22, cutoff=4200, pan=0.0):
    n = secs(dur)
    s = square(mtof(m), n, 0.3) * 0.6 + saw(mtof(m + 0.07), n) * 0.4
    s = lp(s, cutoff) * env(n, 0.002, 0.08, 0.0, 0.03)
    add('music', t, s * g * 0.36, pan=pan)


def lead(t, m, dur, g=1.0):
    n = secs(dur + 0.08)
    tt = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * tt) * np.clip((tt - 0.15) * 4, 0, 1)
    f = mtof(m) * vib
    s = square(f, n, 0.5) * 0.5 + saw(f * 1.003, n) * 0.5
    s = lp(s, 3800) * env(n, 0.01, 0.4, 0.7, 0.08, hold=dur)
    add('music', t, s * g * 0.3, pan=-0.1)
    add('music', t + 0.25, s * g * 0.09, pan=0.6)   # a quarter-note echo


def bell(t, m, g=1.0, dur=2.0):
    n = secs(dur)
    tt = np.arange(n) / SR
    s = sine(mtof(m), n) + 0.5 * sine(mtof(m) * 2.76, n) * np.exp(-tt * 3) + 0.25 * sine(mtof(m) * 5.4, n) * np.exp(-tt * 6)
    s *= np.exp(-tt * 2.2) * np.minimum(1, tt / 0.002)
    add('music', t, s * g * 0.18, pan=0.2)


def riser(t0, t1, g=1.0, f0=300, f1=9000):
    n = secs(t1 - t0)
    tt = np.linspace(0, 1, n)
    s = sweep_lp(noise(n), f0, f1, kind='band', q_width=0.6) * (tt ** 2.2)
    add('fx', t0, s * g * 1.4, pan=-0.2)
    add('fx', t0 + 0.02, s * g * 1.4, pan=0.2)
    tone = saw(np.geomspace(110, 880, n), n)
    add('fx', t0, lp(tone, 2500) * (tt ** 3) * g * 0.12)


def reverse_swell(t_end, g=1.0, dur=1.2):
    n = secs(dur)
    tt = np.arange(n) / SR
    s = hp(noise(n), 2500) * np.exp(-tt * 3.5)
    s = s[::-1]
    add('fx', t_end - dur, s * g * 0.5)


def rewind(t0, t1, g=1.0):
    """The slider flying back to 2023: a falling whoosh with a tape-like pitch glide."""
    n = secs(t1 - t0)
    tt = np.linspace(0, 1, n)
    shape = np.sin(np.pi * tt) ** 0.7
    s = sweep_lp(noise(n), 7000, 250, kind='band', q_width=0.7) * shape * 1.6
    glide = saw(np.geomspace(1400, 70, n), n)
    s += lp(glide, 3000) * shape * 0.12
    add('fx', t0, s * g, pan=0.3)
    add('fx', t0 + 0.015, s * g, pan=-0.3)


# ---- the arrangement ---------------------------------------------------------------
BEAT = plan['beat']
BAR = plan['bar']
A, B, C, D, E, F, G = 57, 59, 60, 62, 64, 65, 67   # A3 B3 C4 D4 E4 F4 G4
CHORDS = {                                       # pad voicing, bass root, arp tones
    'Am': ([A - 12, A, C, E], 33, [A, C, E, A + 12]),
    'F': ([F - 12, A, C, F], 29, [F, A, C, F + 12]),
    'C': ([C - 12, G - 12, C, E], 36, [C, E, G, C + 12]),
    'G': ([G - 24, B, D, G], 31, [G - 12, B, D, G]),
    'Dm': ([D - 12, A - 12, D, F], 26, [D, F, A, D + 12]),
    'E': ([E - 12, 56, B, E], 28, [E - 12, 56, B, E]),
}
PROG = ['Am', 'F', 'C', 'G']


def chord_at_bar(b):
    return PROG[b % 4]


def drums_groove(b0, b1, hats16=True, half=False):
    """Four on the floor with claps on 2 and 4; half time is a kick on 1 and a clap on 3."""
    for b in range(b0, b1):
        for beat in range(4):
            t = b * BAR + beat * BEAT
            if beat == 0 or not half:
                kick(t)
            if half and beat == 2:
                clap(t)
            if not half and beat in (1, 3):
                clap(t, 0.9)
            for s in range(4 if hats16 else 2):
                st = t + s * BEAT / (4 if hats16 else 2)
                accent = (s == 2) if hats16 else (s == 1)
                hat(st, 1.0 if accent else 0.45, pan=0.3 if s % 2 else -0.1)


def bassline(b0, b1, cutoff=700, pattern='eighths'):
    for b in range(b0, b1):
        _, root, _ = CHORDS[chord_at_bar(b)]
        if pattern == 'whole':
            bass(b * BAR, root, BAR * 0.95, cutoff=cutoff)
            continue
        for e in range(8):
            m = root + (12 if e % 2 else 0)
            bass(b * BAR + e * BEAT / 2, m, BEAT / 2 * 0.9, g=1.0 if e % 2 == 0 else 0.7, cutoff=cutoff)


def pads(b0, b1, g=1.0, cutoff=1400):
    for b in range(b0, b1):
        notes, _, _ = CHORDS[chord_at_bar(b)]
        pad(b * BAR, notes, BAR, g=g, cutoff=cutoff, attack=0.25, release=0.6)


def arps(b0, b1, g=1.0, cutoff=4200, octave=12, step=16):
    order = [0, 1, 2, 3, 2, 1, 2, 3]
    for b in range(b0, b1):
        _, _, tones = CHORDS[chord_at_bar(b)]
        for s in range(step):
            m = tones[order[s % 8]] + octave
            pluck(b * BAR + s * BAR / step, m, g=g * (1.0 if s % 4 == 0 else 0.7), cutoff=cutoff,
                  pan=0.35 if s % 2 else -0.35)


# The hook: four bars over Am F C G.
HOOK = [  # (beat offset in the 4-bar phrase, midi, length in beats)
    (0, 76, 1), (1, 74, 0.5), (1.5, 72, 0.5), (2, 74, 1), (3, 72, 1),
    (4, 69, 1.5), (5.5, 72, 0.5), (6, 77, 1), (7, 76, 1),
    (8, 76, 1), (9, 79, 0.5), (9.5, 76, 0.5), (10, 74, 1), (11, 72, 1),
    (12, 71, 1.5), (13.5, 74, 0.5), (14, 79, 1), (15, 71, 1),
]


def hook(b0, g=1.0, transpose=0):
    for off, m, ln in HOOK:
        lead(b0 * BAR + off * BEAT, m + transpose, ln * BEAT * 0.92, g=g)


# 0-8 s: black, a clock, a drone, then the rewind
for k in range(16):
    tick(k * BEAT, 0.8 if k < 12 else 0.6, tock=k % 2 == 1)
pad(0.0, [A - 24, A - 12, E - 12], 6.2, g=0.55, cutoff=500, attack=2.5, release=1.2)
boom(0.0, 0.35, dur=3.0)
reverse_swell(6.3, 0.8, dur=1.4)
rewind(6.2, 7.95, 0.9)

# The slider clicks through every day it passes
last_click = -1
for t, i in plan['dayTrack']:
    if t - last_click >= 0.035:
        click(t, 0.9 if 6 < t < 8 else 0.7, pitch=1.0 + 0.25 * np.sin(i))
        last_click = t

# 8-16 s: day one. A soft hit, chords, a music box, the clock carries on
boom(8.0, 0.8)
crash(8.0, 0.5, dur=3.0)
for b in range(4, 8):
    notes, root, tones = CHORDS[chord_at_bar(b)]
    pad(b * BAR, notes, BAR, g=0.8, cutoff=900, attack=0.1, release=0.6)
    bass(b * BAR, root, BAR * 0.95, cutoff=380, g=0.8)
for k in range(16, 30):
    tick(k * BEAT, 0.45, tock=k % 2 == 1)
MUSIC_BOX = [81, 76, 72, 76, 81, 84, 83, 79, 77, 72, 69, 72, 76, 79, 74, 71]
for s, m in enumerate(MUSIC_BOX * 2):
    if 8.0 + s * 0.25 < 14.0:
        bell(8.0 + s * 0.25, m, g=0.55 if s % 2 == 0 else 0.35, dur=1.0)
riser(12.0, 16.0, 0.9)
for k in range(8):                     # snare build over the last bar
    snare(14.0 + k * 0.25, 0.3 + 0.08 * k)
for k in range(8):
    snare(15.0 + k * 0.125, 0.5 + 0.05 * k)

# 16-48 s: the scrub. Full groove; every era lands with a hit
drums_groove(8, 24)
bassline(8, 24)
pads(8, 24, g=0.55, cutoff=1800)
arps(8, 16, g=0.8, cutoff=3000)
arps(16, 24, g=0.9, cutoff=5200)
hook(16, 0.9)
hook(20, 1.0)
for era in plan['eras']:
    crash(era['t'], 0.9)
    boom(era['t'], 0.55, dur=1.6)
reverse_swell(20.0, 0.6)
reverse_swell(38.0, 0.6)
reverse_swell(42.0, 0.8)
riser(44.0, 48.0, 0.6)
for k in range(8):
    snare(47.0 + k * 0.125, 0.4 + 0.07 * k)

# 48-58 s: every page keeps its versions. A breath, then the snake steps through its own
boom(48.0, 0.6)
crash(48.0, 0.6, dur=3)
pad(48.0, CHORDS['F'][0], 2.0, g=0.7, cutoff=900)
pad(50.0, CHORDS['C'][0], 2.0, g=0.7, cutoff=1000)
for k in range(8):
    tick(48.0 + k * BEAT, 0.4, tock=k % 2 == 1)
arps(24, 25, g=0.45, cutoff=1500)
reverse_swell(50.0, 0.7)
drums_groove(25, 29, hats16=False, half=True)
bassline(25, 29, cutoff=500, pattern='whole')
pads(25, 29, g=0.5, cutoff=1300)
PENTA = [69, 72, 74, 76, 79, 81, 84, 86, 88, 91]
for k, (t, v) in enumerate(plan['snake']['track']):
    m = PENTA[min(k, 18) * len(PENTA) // 19]
    blip(t, m, g=1.0 if k in (0, 6, 16, 18) else 0.75)
    if k in (16, 18):
        crash(t, 0.4)

# 58-66 s: first version against the latest; each wipe lands with a swish
for p in plan['pairs']:
    reverse_swell(p['t'], 0.45, dur=0.6)
    crash(p['t'], 0.4, dur=1.4)
drums_groove(29, 33)
bassline(29, 33, cutoff=900)
pads(29, 33, g=0.5, cutoff=2000)
arps(29, 33, g=0.8, cutoff=5500)
hook(29, 0.95)

# 66-74 s: the commit log, quoted like critics. The groove thins out so the words land;
# every quote gets a chord stab, the last (five stars) the full band again
QUOTE_CHORDS = ['Dm', 'Am', 'F', 'E']
for n, q in enumerate(plan['quotes']):
    t = q['t']
    notes, root, tones = CHORDS[QUOTE_CHORDS[n]]
    pad(t, notes + [notes[-1] + 12], 1.9, g=0.75, cutoff=2600, attack=0.01, release=0.4)
    bass(t, root, 1.8, cutoff=500)
    boom(t, 0.4, dur=1.2)
    for k in range(q['stars']):                     # one ding per star
        bell(t + 0.35 + k * 0.125, 88 + [0, 2, 4, 7, 9][k], g=0.35, dur=0.8)
    for beat in range(4):
        kick(t + beat * BEAT, 0.8)
        hat(t + beat * BEAT + 0.25, 0.6)
        if beat in (1, 3):
            clap(t + beat * BEAT, 0.6)
crash(72.0, 0.7, dur=2.0)
for k in range(8):
    snare(73.0 + k * 0.125, 0.35 + 0.05 * k)

# 74-84 s: the wall. Build, build, stop.
PROG_WALL = ['F', 'G', 'Am', 'F', 'G']
for n, name in enumerate(PROG_WALL):
    t = 74.0 + n * BAR
    notes, root, tones = CHORDS[name]
    pad(t, notes + [notes[-1] + 12], BAR if n < 4 else 1.5, g=0.65, cutoff=1500 + 700 * n)
    for e in range(8 if n < 4 else 6):
        bass(t + e * 0.25, root + (12 if e % 2 else 0), 0.22, cutoff=600 + 250 * n)
    for s_ in range(16 if n < 4 else 12):
        pluck(t + s_ * 0.125, tones[s_ % 4] + 12 + (12 if n >= 3 else 0), g=0.6 + 0.08 * n,
              cutoff=3500 + 800 * n, pan=0.35 if s_ % 2 else -0.35)
for b in range(37, 41):
    for beat in range(4):
        kick(b * BAR + beat * BEAT)
        hat(b * BAR + beat * BEAT + 0.25, 0.8)
kick(82.0); kick(82.5); kick(83.0)
for k in range(8):
    snare(78.0 + k * 0.25, 0.35 + 0.03 * k)
for k in range(16):
    snare(80.0 + k * 0.125, 0.45 + 0.02 * k)
for k in range(12):
    snare(82.0 + k * 0.125, 0.65 + 0.03 * k)
riser(78.0, 83.5, 1.1)
for t, _ in plan['stats']:
    boom(t, 0.35, dur=1.2)
    crash(t, 0.35, dur=1.2)

# 84-96 s: today. One hit, a long chord, a slowing clock, the title
T0 = plan['back']
boom(T0, 1.3, dur=4.0)
crash(T0, 1.1, dur=4.5)
kick(T0, 1.2)
pad(T0, [A - 24, A - 12, E - 12, A, B, C, E], 9.0, g=0.8, cutoff=2400, attack=0.05, release=2.5)
bass(T0, 33, 5.0, cutoff=300)
for k, m in enumerate([81, 76, 83, 84, 88, 83, 81, 76]):
    bell(T0 + k * 0.5, m, g=0.8 - 0.05 * k, dur=2.5)
for k, m in enumerate([69, 72, 76, 81]):
    bell(plan['title'] + k * 0.125, m + 12, g=0.5, dur=3.0)
for n, t in enumerate((88.0, 89.0, 90.0, 91.25, 92.75, 94.5)):
    tick(t, 0.6, tock=n % 2 == 1)
bell(94.5, 81, g=0.5, dur=1.5)

# ---- mixdown -----------------------------------------------------------------------

def reverb_ir(seconds=2.4, damp=5000):
    n = secs(seconds)
    tt = np.arange(n) / SR
    ir = np.stack([lp(noise(n), damp) * np.exp(-tt * 3.0), lp(noise(n), damp) * np.exp(-tt * 3.0)])
    ir[:, :secs(0.01)] *= np.linspace(0, 1, secs(0.01))
    return ir / np.sqrt((ir ** 2).sum(axis=1, keepdims=True))


ir = reverb_ir()
wet = np.zeros((2, N))
send = bus['music'] * 0.35 + bus['fx'] * 0.9 + bus['drums'] * 0.08
for ch in range(2):
    wet[ch] = fftconvolve(send[ch], ir[ch])[:N]

# Sidechain: everything melodic ducks under the kick a little
kick_env = np.abs(bus['drums'][0])
kick_env = lp(kick_env, 20, 1)
duck = 1 - 0.35 * np.clip(kick_env / (kick_env.max() + 1e-9) * 3, 0, 1)

mix = bus['drums'] * 0.9 + (bus['music'] + bus['fx'] * 0.8) * duck + bus['dry'] + wet * 0.5
mix = hp(mix, 35)
mix = mix + 0.45 * bp(mix, 900, 6000) + 0.3 * hp(mix, 5000)   # presence and a little air
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
fade = np.ones(N)
fade[-secs(1.2):] = np.linspace(1, 0, secs(1.2))
mix *= fade
mix *= 0.89 / np.abs(mix).max()
out = sys.argv[1] if len(sys.argv) > 1 else str(BUILD / 'soundtrack.wav')
wavfile.write(out, SR, (mix.T * 32767).astype(np.int16))
rms = np.sqrt((mix ** 2).mean())
print(f'{out}: {DUR:.1f} s, peak {np.abs(mix).max():.2f}, rms {20 * np.log10(rms):.1f} dBFS')
