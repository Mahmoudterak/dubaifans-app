#!/usr/bin/env python3
"""Heuristic short-video scorer modelled on the Virality Predictor dashboard.

This is NOT Higgsfield's model. It measures simple, observable properties of a
video (motion, cuts, contrast, colour, loudness dynamics, hook strength) with
ffmpeg and numpy, then maps them to 0-100 scores. Treat the output as a rough
creative checklist, not a prediction of real performance.

Usage:
    python3 analyze.py <video> [--out-dir DIR]

Writes <out-dir>/report.json and <out-dir>/report.html.
"""

from __future__ import annotations

import argparse
import html
import json
import math
import os
import subprocess
import sys

import numpy as np

SAMPLE_FPS = 2          # frames per second used for motion and cut detection
THUMB_W, THUMB_H = 96, 54
CUT_THRESHOLD = 0.35    # normalised frame-difference that counts as a cut
AUDIO_RATE = 8000


def run_bytes(cmd: list[str]) -> bytes:
    proc = subprocess.run(cmd, capture_output=True)
    if proc.returncode != 0:
        raise RuntimeError(f"command failed: {' '.join(cmd[:3])} ...\n{proc.stderr.decode(errors='replace')[-800:]}")
    return proc.stdout


def probe(path: str) -> dict:
    out = run_bytes([
        "ffprobe", "-v", "error", "-print_format", "json",
        "-show_format", "-show_streams", path,
    ])
    info = json.loads(out)
    video = next((s for s in info.get("streams", []) if s.get("codec_type") == "video"), None)
    if video is None:
        raise RuntimeError("no video stream found")
    duration = float(info.get("format", {}).get("duration") or video.get("duration") or 0)
    return {
        "duration": duration,
        "width": int(video.get("width", 0)),
        "height": int(video.get("height", 0)),
        "has_audio": any(s.get("codec_type") == "audio" for s in info.get("streams", [])),
    }


def read_frames(path: str) -> np.ndarray:
    """Return frames as float array (N, H, W, 3) in 0..1 at SAMPLE_FPS."""
    raw = run_bytes([
        "ffmpeg", "-v", "error", "-i", path,
        "-vf", f"fps={SAMPLE_FPS},scale={THUMB_W}:{THUMB_H},format=rgb24",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
    ])
    frame_size = THUMB_W * THUMB_H * 3
    n = len(raw) // frame_size
    if n == 0:
        raise RuntimeError("could not decode any video frames")
    arr = np.frombuffer(raw[: n * frame_size], dtype=np.uint8).reshape(n, THUMB_H, THUMB_W, 3)
    return arr.astype(np.float32) / 255.0


def read_audio_rms(path: str, duration: float) -> np.ndarray:
    """Per-second RMS loudness in dBFS (empty array if no audio)."""
    raw = run_bytes([
        "ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "1",
        "-ar", str(AUDIO_RATE), "-f", "s16le", "pipe:1",
    ])
    samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    if samples.size == 0:
        return np.array([])
    seconds = max(1, int(math.ceil(duration)))
    per = AUDIO_RATE
    rms = []
    for s in range(seconds):
        chunk = samples[s * per:(s + 1) * per]
        if chunk.size == 0:
            break
        r = float(np.sqrt(np.mean(chunk ** 2)) + 1e-9)
        rms.append(20 * math.log10(r))
    return np.array(rms)


def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def analyse(path: str) -> dict:
    meta = probe(path)
    frames = read_frames(path)
    n = frames.shape[0]
    gray = frames.mean(axis=3)

    # Motion between consecutive sampled frames (mean absolute difference).
    if n > 1:
        diffs = np.abs(np.diff(gray, axis=0)).mean(axis=(1, 2))
    else:
        diffs = np.zeros(1)
    motion = np.concatenate([[diffs[0]], diffs]) if n > 1 else diffs

    # Cuts: large spikes in motion.
    cut_flags = diffs > CUT_THRESHOLD * max(diffs.max(), 1e-6) if n > 1 else np.array([False])
    cut_flags = cut_flags & (diffs > 0.08)
    cut_times = [round(float(i + 1) / SAMPLE_FPS, 2) for i in np.nonzero(cut_flags)[0]]

    # Visual qualities over the whole clip.
    contrast = float(gray.std(axis=(1, 2)).mean())               # ~0..0.3 typical
    sat = frames.max(axis=3) - frames.min(axis=3)
    colourfulness = float(sat.mean())                              # ~0..0.5 typical
    brightness = float(gray.mean())
    balance = 1 - abs(brightness - 0.5) * 2                        # 1 = mid-tone

    visual_score = 100 * (
        0.40 * clamp(contrast / 0.18)
        + 0.35 * clamp(colourfulness / 0.25)
        + 0.25 * clamp(balance)
    )

    # Motion / cut density drive attention.
    motion_mean = float(motion.mean())
    static_share = float((motion < 0.01).mean())
    cut_density = len(cut_times) / max(meta["duration"], 1) * 10   # cuts per 10 s
    attention_score = 100 * clamp(
        0.45 * clamp(motion_mean / 0.04)
        + 0.30 * clamp(cut_density / 4)
        + 0.25 * (1 - static_share)
    )

    # Audio dynamics (only if present).
    rms = read_audio_rms(path, meta["duration"]) if meta["has_audio"] else np.array([])
    if rms.size:
        audio_std = float(np.std(rms))
        silence_share = float((rms < -50).mean())
        audio_dyn = clamp(audio_std / 6)
        audio_present = 1 - silence_share
    else:
        audio_dyn = 0.0
        audio_present = 0.0

    # Memory: cuts, audio dynamics and distinctiveness of colour.
    memory_score = 100 * clamp(
        0.40 * clamp(cut_density / 4)
        + 0.30 * audio_dyn
        + 0.15 * audio_present
        + 0.15 * clamp(colourfulness / 0.25)
    )

    # Hook: the first three seconds carry the most weight.
    head = motion[: SAMPLE_FPS * 3]
    hook_motion = float(head.mean()) if head.size else 0.0
    hook_contrast = float(gray[: SAMPLE_FPS * 3].std(axis=(1, 2)).mean()) if n else 0.0
    hook_score = 100 * clamp(0.6 * clamp(hook_motion / 0.04) + 0.4 * clamp(hook_contrast / 0.18))

    overall = 0.25 * visual_score + 0.35 * attention_score + 0.15 * memory_score + 0.25 * hook_score

    # Retention curve: viewers leave faster when the second is low-engagement.
    seconds = max(1, int(math.ceil(meta["duration"])))
    per_second_engagement = []
    for s in range(seconds):
        idx = slice(s * SAMPLE_FPS, (s + 1) * SAMPLE_FPS)
        m = float(motion[idx].mean()) if motion[idx].size else 0.0
        per_second_engagement.append(clamp(m / 0.04))
    curve = [100.0]
    viewers = 100.0
    for e in per_second_engagement:
        drop = 0.02 + 0.06 * (1 - e)   # 2% to 8% lost per second
        viewers *= (1 - drop)
        curve.append(round(viewers, 1))

    def fmt_t(t: float) -> str:
        return f"{int(t // 60)}:{int(t % 60):02d}"

    marks = []
    for t in sorted({0, 3, 6, 10, 14, 21, int(meta["duration"])}):
        if 0 <= t <= len(curve) - 1:
            marks.append({"time": fmt_t(t), "retention": round(curve[t], 1)})

    weakest = int(np.argmin(per_second_engagement)) if per_second_engagement else 0
    curve = [float(v) for v in curve]
    return {
        "disclaimer": "Heuristic estimate from measurable video properties. Not Higgsfield's Virality Predictor model.",
        "file": os.path.basename(path),
        "meta": meta,
        "scores": {
            "overall": round(overall),
            "visual": round(visual_score),
            "attention": round(attention_score),
            "memory": round(memory_score),
            "hook": round(hook_score),
        },
        "details": {
            "cuts": len(cut_times),
            "cut_times": cut_times,
            "static_share_pct": round(static_share * 100),
            "contrast": round(contrast, 3),
            "colourfulness": round(colourfulness, 3),
            "brightness": round(brightness, 3),
            "audio_dynamics_pct": round(audio_dyn * 100),
            "weakest_second": fmt_t(weakest),
        },
        "retention": marks,
        "curve": curve,
    }


def render_html(report: dict) -> str:
    s = report["scores"]
    d = report["details"]
    curve = report["curve"]

    # SVG retention curve.
    w, h, pad = 900, 220, 30
    n = len(curve)
    pts = []
    for i, v in enumerate(curve):
        x = pad + (w - 2 * pad) * (i / max(n - 1, 1))
        y = pad + (h - 2 * pad) * (1 - v / 100)
        pts.append(f"{x:.1f},{y:.1f}")
    poly = " ".join(pts)
    area = f"{pad},{h - pad} " + poly + f" {w - pad},{h - pad}"

    def bar(label: str, value: int) -> str:
        return (
            f'<div class="row"><span class="lbl">{html.escape(label)}</span>'
            f'<div class="track"><div class="fill" style="width:{value}%"></div></div>'
            f'<span class="val">{value}%</span></div>'
        )

    marks = "".join(
        f'<div class="tick"><div class="t">{html.escape(m["time"])}</div>'
        f'<div class="p">{m["retention"]}%</div></div>'
        for m in report["retention"]
    )

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Virality report: {html.escape(report['file'])}</title>
<style>
:root {{ --bg:#0b1a1f; --panel:#0f2228; --line:#2b4a52; --text:#e6f2f2; --muted:#7f9ca2;
  --teal:#4fb7b0; --gold:#f2b544; --red:#e08b7f; }}
@media (prefers-color-scheme: light) {{
  :root:not([data-theme="dark"]) {{ --bg:#eef5f5; --panel:#ffffff; --line:#c9dadd; --text:#10262b; --muted:#56727a; }}
}}
:root[data-theme="dark"] {{ --bg:#0b1a1f; --panel:#0f2228; --line:#2b4a52; --text:#e6f2f2; --muted:#7f9ca2; }}
body {{ margin:0; background:var(--bg); color:var(--text); font-family: system-ui, sans-serif; }}
main {{ max-width: 960px; margin: 0 auto; padding: 24px 16px 48px; }}
h1 {{ font-size: 22px; margin: 0 0 4px; }}
.sub {{ color: var(--muted); font-size: 13px; margin-bottom: 20px; }}
.hero {{ background: var(--panel); border:1px solid var(--line); border-radius: 16px; padding: 24px; text-align:center; }}
.big {{ font-size: 72px; font-weight: 800; color: var(--gold); line-height: 1; }}
.big small {{ font-size: 22px; color: var(--muted); }}
.grid {{ display:grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }}
@media (max-width: 640px) {{ .grid {{ grid-template-columns: 1fr; }} }}
.card {{ background: var(--panel); border:1px solid var(--line); border-radius: 14px; padding: 18px; }}
.card h2 {{ font-size: 14px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 0 0 12px; }}
.row {{ display:flex; align-items:center; gap:10px; margin: 10px 0; }}
.lbl {{ width: 90px; font-size: 14px; }}
.track {{ flex:1; height: 10px; background: var(--line); border-radius: 6px; overflow:hidden; }}
.fill {{ height:100%; background: var(--teal); border-radius: 6px; }}
.val {{ width: 48px; text-align:right; font-variant-numeric: tabular-nums; font-size: 14px; }}
.ticks {{ display:flex; justify-content: space-between; margin-top: 8px; }}
.tick {{ text-align:center; }}
.tick .t {{ color: var(--muted); font-size: 12px; }}
.tick .p {{ font-size: 15px; font-weight: 600; }}
.note {{ color: var(--muted); font-size: 12px; margin-top: 16px; line-height: 1.5; }}
dl {{ display:grid; grid-template-columns: auto 1fr; gap: 6px 14px; margin: 0; font-size: 14px; }}
dt {{ color: var(--muted); }} dd {{ margin: 0; }}
svg {{ width: 100%; height: auto; }}
</style>
</head>
<body>
<main>
  <h1>Virality report</h1>
  <div class="sub">{html.escape(report['file'])} · {report['meta']['width']}×{report['meta']['height']} · {report['meta']['duration']:.1f}s</div>

  <section class="hero">
    <div class="big">{s['overall']}<small>/100</small></div>
    <div class="sub">Overall heuristic score</div>
  </section>

  <div class="grid">
    <section class="card">
      <h2>Signals</h2>
      {bar('Visual', s['visual'])}
      {bar('Attention', s['attention'])}
      {bar('Memory', s['memory'])}
      {bar('Hook (0–3s)', s['hook'])}
    </section>

    <section class="card">
      <h2>Details</h2>
      <dl>
        <dt>Cuts</dt><dd>{d['cuts']} at {', '.join(str(t) + 's' for t in d['cut_times'][:8]) or 'none'}</dd>
        <dt>Static time</dt><dd>{d['static_share_pct']}%</dd>
        <dt>Contrast</dt><dd>{d['contrast']}</dd>
        <dt>Colourfulness</dt><dd>{d['colourfulness']}</dd>
        <dt>Audio dynamics</dt><dd>{d['audio_dynamics_pct']}%</dd>
        <dt>Weakest second</dt><dd>{d['weakest_second']}</dd>
      </dl>
    </section>
  </div>

  <section class="card" style="margin-top:16px">
    <h2>Estimated retention</h2>
    <svg viewBox="0 0 {w} {h}" role="img" aria-label="Retention curve">
      <polygon points="{area}" fill="rgba(79,183,176,0.15)"></polygon>
      <polyline points="{poly}" fill="none" stroke="var(--teal)" stroke-width="3" stroke-linejoin="round"></polyline>
    </svg>
    <div class="ticks">{marks}</div>
  </section>

  <p class="note">{html.escape(report['disclaimer'])} Scores come from motion, cuts, contrast, colour and loudness only. They do not measure the message, the creator, the product or the audience.</p>
</main>
</body>
</html>
"""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video")
    ap.add_argument("--out-dir", default=None)
    args = ap.parse_args()

    if not os.path.isfile(args.video):
        print(f"file not found: {args.video}", file=sys.stderr)
        return 2
    out_dir = args.out_dir or os.path.join(os.path.dirname(os.path.abspath(args.video)), "virality-report")
    os.makedirs(out_dir, exist_ok=True)

    report = analyse(args.video)
    with open(os.path.join(out_dir, "report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    with open(os.path.join(out_dir, "report.html"), "w", encoding="utf-8") as f:
        f.write(render_html(report))

    s = report["scores"]
    print(f"overall={s['overall']} visual={s['visual']} attention={s['attention']} memory={s['memory']} hook={s['hook']}")
    print(f"report: {os.path.join(out_dir, 'report.html')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
