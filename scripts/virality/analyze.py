#!/usr/bin/env python3
"""Heuristic short-video analyser that follows the five-channel data-flow design.

    raw video
      -> demux: video frames (ffmpeg) and audio samples (ffmpeg), read separately
      -> visual channel: contrast, colourfulness, optical-flow motion, cut detection
      -> audio channel: loudness per second, FFT spectral centroid and bright-band ratio,
         speech-rhythm estimate from envelope peaks
      -> feature vector M (motion), C (cuts), T (contrast), L (colour), A (audio)
      -> heuristic scoring engine (weights and thresholds in thresholds.json)
      -> score bands and style tags

This is NOT Higgsfield's Virality Predictor model. Every number comes from a simple,
observable property of the file. Use it as a creative checklist, not a forecast.

Usage:
    python3 analyze.py <video> [--out-dir DIR]

Writes <out-dir>/report.json and <out-dir>/report.html.
Optical flow uses OpenCV when it is installed; otherwise it falls back to frame
differences and the report says which method was used.
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

HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, "thresholds.json"), encoding="utf-8") as _f:
    TH = json.load(_f)

try:  # optional: real optical flow
    import cv2  # type: ignore
    HAVE_CV2 = True
except Exception:  # pragma: no cover - depends on the environment
    cv2 = None
    HAVE_CV2 = False

AUDIO_RATE = 16000
FPS = TH["sample_fps"]
W, H = TH["frame_width"], TH["frame_height"]


def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, float(x)))


def run_bytes(cmd: list[str]) -> bytes:
    proc = subprocess.run(cmd, capture_output=True)
    if proc.returncode != 0:
        tail = proc.stderr.decode(errors="replace")[-800:]
        raise RuntimeError(f"{cmd[0]} failed: {tail}")
    return proc.stdout


def probe(path: str) -> dict:
    info = json.loads(run_bytes([
        "ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", path,
    ]))
    streams = info.get("streams", [])
    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    if video is None:
        raise RuntimeError("no video stream found")
    duration = float(info.get("format", {}).get("duration") or video.get("duration") or 0)
    return {
        "duration": duration,
        "width": int(video.get("width", 0)),
        "height": int(video.get("height", 0)),
        "has_audio": any(s.get("codec_type") == "audio" for s in streams),
    }


def demux_video(path: str, duration: float) -> np.ndarray:
    """Video channel: RGB frames at FPS, resized to W x H, as uint8 (N, H, W, 3)."""
    raw = run_bytes([
        "ffmpeg", "-v", "error", "-i", path,
        "-t", str(min(duration, 120)),
        "-vf", f"fps={FPS},scale={W}:{H},format=rgb24",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
    ])
    frame = W * H * 3
    n = len(raw) // frame
    if n == 0:
        raise RuntimeError("could not decode any video frames")
    return np.frombuffer(raw[: n * frame], dtype=np.uint8).reshape(n, H, W, 3)


def demux_audio(path: str) -> np.ndarray:
    """Audio channel: mono float samples in -1..1 at AUDIO_RATE (empty if no audio)."""
    raw = run_bytes([
        "ffmpeg", "-v", "error", "-i", path, "-vn", "-t", "120",
        "-ac", "1", "-ar", str(AUDIO_RATE), "-f", "s16le", "pipe:1",
    ])
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0


def visual_channel(frames: np.ndarray) -> dict:
    """Contrast, colourfulness, motion per step, and per-step frame differences."""
    rgb = frames.astype(np.float32) / 255.0
    gray = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)          # (N, H, W)
    sat = rgb.max(axis=3) - rgb.min(axis=3)                                  # HSV-style saturation

    contrast = float(gray.std(axis=(1, 2)).mean())
    colour = float(sat.mean())
    brightness = float(gray.mean())

    diffs = np.abs(np.diff(gray, axis=0)).mean(axis=(1, 2)) if len(gray) > 1 else np.zeros(1)

    flow_mag = None
    method = "frame-difference"
    if HAVE_CV2 and len(frames) > 1:
        method = "optical-flow (Farneback)"
        grey8 = (gray * 255).astype(np.uint8)
        mags = []
        for i in range(len(grey8) - 1):
            f = cv2.calcOpticalFlowFarneback(grey8[i], grey8[i + 1], None, 0.5, 2, 9, 2, 5, 1.1, 0)
            mags.append(float(np.linalg.norm(f, axis=2).mean()))
        flow_mag = np.array(mags)
    return {
        "contrast": contrast, "colour": colour, "brightness": brightness,
        "diffs": diffs, "flow": flow_mag, "method": method, "gray": gray,
    }


def detect_cuts(diffs: np.ndarray) -> list[float]:
    if diffs.size == 0:
        return []
    med = float(np.median(diffs)) + 1e-6
    cut = (diffs > TH["cuts"]["diff_ratio_of_median"] * med) & (diffs > TH["cuts"]["min_diff"])
    return [round((i + 1) / FPS, 2) for i in np.nonzero(cut)[0]]


def audio_channel(samples: np.ndarray, duration: float) -> dict | None:
    """Loudness per second, FFT spectral centroid and bright-band ratio, speech rhythm."""
    if samples.size == 0:
        return None
    sr = AUDIO_RATE
    secs = max(1, int(math.ceil(duration)))
    rms_db, centroid, bright = [], [], []
    freqs = np.fft.rfftfreq(sr, d=1.0 / sr)
    for s in range(secs):
        chunk = samples[s * sr:(s + 1) * sr]
        if chunk.size < sr // 4:
            break
        rms = float(np.sqrt(np.mean(chunk ** 2)) + 1e-9)
        rms_db.append(20 * math.log10(rms))
        spec = np.abs(np.fft.rfft(chunk * np.hanning(chunk.size), n=sr)) ** 2
        total = float(spec.sum()) + 1e-12
        centroid.append(float((freqs * spec).sum() / total))
        bright.append(float(spec[freqs >= 2000].sum() / total))

    # Envelope peaks per second (syllable-like rhythm), 50 Hz envelope.
    win = sr // 50
    usable = samples[: (samples.size // win) * win]
    env = np.sqrt((usable.reshape(-1, win) ** 2).mean(axis=1)) if usable.size else np.array([])
    env_mean = float(env.mean()) if env.size else 0.0
    peaks_per_s = []
    for s in range(len(rms_db)):
        seg = env[s * 50:(s + 1) * 50]
        if seg.size < 2:
            peaks_per_s.append(0)
            continue
        peaks_per_s.append(int(np.sum((seg[:-1] < env_mean) & (seg[1:] >= env_mean))))
    return {
        "rms_db": rms_db, "centroid_hz": centroid, "bright_ratio": bright,
        "peaks_per_s": peaks_per_s,
    }


def clamp_list(vals):
    return [float(v) for v in vals]


def analyse(path: str) -> dict:
    meta = probe(path)
    duration = meta["duration"]
    frames = demux_video(path, duration)
    v = visual_channel(frames)
    n_steps = max(1, len(v["diffs"]))

    motion_series = v["flow"] if v["flow"] is not None else v["diffs"]
    motion_series = np.concatenate([[motion_series[0]], motion_series]) if motion_series.size else np.zeros(1)
    if v["flow"] is not None:
        motion_norm = TH["motion"]["flow_norm_px"]
    else:
        motion_norm = TH["motion"]["diff_norm"]
    motion_mean = float(motion_series.mean())
    # A step counts as static when its motion is below a fraction of the motion norm.
    static_share = float((motion_series < TH["static"]["motion_eps"] * motion_norm).mean())

    cuts = detect_cuts(v["diffs"])
    dur = max(duration, 1e-6)
    cuts_per_10s = len(cuts) / dur * 10

    # Audio channel.
    a = audio_channel(demux_audio(path), duration) if meta["has_audio"] else None
    has_audio = a is not None and len(a["rms_db"]) > 0
    if has_audio:
        rms = np.array(a["rms_db"])
        silence_share = float((rms < TH["audio"]["silence_db"]).mean())
        dyn = clamp(float(rms.std()) / TH["audio"]["dyn_norm_db"])
        present = 1 - silence_share
        mean_db = float(rms[rms >= TH["audio"]["silence_db"]].mean()) if (rms >= TH["audio"]["silence_db"]).any() else -90.0
        centroid_mean = float(np.mean(a["centroid_hz"]))
        bright_mean = float(np.mean(a["bright_ratio"]))
        speech_ok = [
            TH["speech"]["min_peaks_per_s"] <= p <= TH["speech"]["max_peaks_per_s"] and r >= TH["audio"]["quiet_db"]
            for p, r in zip(a["peaks_per_s"], a["rms_db"])
        ]
        speech_share = float(np.mean(speech_ok)) if speech_ok else 0.0
    else:
        dyn = present = 0.0
        mean_db = -90.0
        centroid_mean = bright_mean = speech_share = 0.0

    # Feature vector (each 0..1): M motion, C cuts, T contrast, L colour, A audio.
    feat = {
        "M": clamp(motion_mean / motion_norm),
        "C": clamp(cuts_per_10s / TH["cuts"]["density_full_per_10s"]),
        "T": clamp(v["contrast"] / TH["contrast"]["norm"]),
        "L": clamp(v["colour"] / TH["colour"]["norm"]),
        "A": clamp(0.5 * dyn + 0.5 * present) if has_audio else 0.0,
    }

    # Channel scores (0..100).
    visual_score = 100 * (0.40 * feat["T"] + 0.35 * feat["L"] + 0.25 * clamp(1 - abs(v["brightness"] - 0.5) * 2))
    attention_score = 100 * clamp(0.45 * feat["M"] + 0.30 * feat["C"] + 0.25 * (1 - static_share))
    memory_score = 100 * clamp(0.40 * feat["C"] + 0.30 * dyn + 0.15 * present + 0.15 * feat["L"])
    hook_s = TH["hook"]["seconds"] * FPS
    head_motion = float(motion_series[:hook_s].mean()) if motion_series.size else 0.0
    head_contrast = float(v["gray"][:hook_s].std(axis=(1, 2)).mean()) if len(v["gray"]) else 0.0
    hook_score = 100 * clamp(0.6 * clamp(head_motion / motion_norm) + 0.4 * clamp(head_contrast / TH["hook"]["contrast_norm"]))
    if has_audio:
        hearing_score = 100 * clamp(0.6 * present + 0.4 * dyn)
        language_score = 100 * clamp(speech_share)
    else:
        hearing_score = language_score = 0.0

    W_ = TH["overall_weights"]
    overall = (W_["visual"] * visual_score + W_["attention"] * attention_score
               + W_["memory"] * memory_score + W_["hook"] * hook_score)

    # Retention: viewers leave faster during low-motion seconds.
    secs = max(1, int(math.ceil(duration)))
    eng = []
    for s in range(secs):
        seg = motion_series[s * FPS:(s + 1) * FPS]
        eng.append(clamp((float(seg.mean()) if seg.size else 0.0) / motion_norm))
    curve = [100.0]
    viewers = 100.0
    for e in eng:
        viewers *= 1 - (0.02 + 0.06 * (1 - e))
        curve.append(round(viewers, 1))
    weakest = int(np.argmin(eng)) if eng else 0

    def fmt_t(t: float) -> str:
        return f"{int(t // 60)}:{int(t % 60):02d}"

    marks = []
    for t in [0, 3, 6, 10, 14, 21]:
        valid = t <= duration
        marks.append({"time": fmt_t(t), "retention": round(curve[min(t, len(curve) - 1)], 1) if valid else None})

    tags = classify(feat, cuts_per_10s, mean_db, motion_mean, motion_norm, has_audio)

    scores = {
        "overall": round(overall), "visual": round(visual_score), "attention": round(attention_score),
        "memory": round(memory_score), "hook": round(hook_score),
        "hearing": round(hearing_score), "language": round(language_score),
    }
    band = "high" if scores["overall"] >= TH["score_bands"]["high"] else "mid" if scores["overall"] >= TH["score_bands"]["mid"] else "low"

    return {
        "disclaimer": "Heuristic estimate from measurable video properties. Not Higgsfield's Virality Predictor model.",
        "file": os.path.basename(path),
        "meta": meta,
        "method": {"motion": v["method"], "audio_fft": has_audio, "thresholds": "thresholds.json"},
        "feature_vector": {k: round(val, 3) for k, val in feat.items()},
        "scores": scores,
        "band": band,
        "tags": tags,
        "details": {
            "cuts": len(cuts), "cut_times": cuts[:20],
            "static_share_pct": round(static_share * 100),
            "contrast": round(v["contrast"], 3), "colourfulness": round(v["colour"], 3),
            "brightness": round(v["brightness"], 3),
            "audio_dynamics_pct": round(dyn * 100) if has_audio else None,
            "audio_mean_db": round(mean_db, 1) if has_audio else None,
            "spectral_centroid_hz": round(centroid_mean) if has_audio else None,
            "bright_band_pct": round(bright_mean * 100) if has_audio else None,
            "speech_rhythm_pct": round(speech_share * 100) if has_audio else None,
            "weakest_second": fmt_t(weakest),
        },
        "retention": marks,
        "curve": curve,
    }


def classify(feat: dict, cuts_per_10s: float, mean_db: float, motion_mean: float, motion_norm: float, has_audio: bool) -> list[str]:
    tg = TH["tags"]
    motion_rel = motion_mean / motion_norm
    out = []
    if cuts_per_10s >= tg["fast_rhythm_cuts_per_10s"] or motion_rel >= tg["fast_rhythm_motion"]:
        out.append("fast-rhythm")
    if motion_rel <= tg["calm_motion"] and cuts_per_10s <= tg["calm_cuts_per_10s"]:
        out.append("calm")
    if has_audio and mean_db >= tg["high_energy_loud_db"] and motion_rel >= tg["high_energy_motion"]:
        out.append("high-energy")
    if feat["T"] >= tg["sharp_contrast"]:
        out.append("sharp-contrast")
    if feat["T"] <= tg["low_contrast"]:
        out.append("low-contrast")
    if not has_audio:
        out.append("silent")
    return out or ["balanced"]


# ---------- HTML report (static, for the CLI) ----------

def render_html(report: dict) -> str:
    s = report["scores"]
    d = report["details"]
    curve = report["curve"]
    w, h, pad = 900, 220, 30
    n = len(curve)
    pts = []
    for i, val in enumerate(curve):
        x = pad + (w - 2 * pad) * (i / max(n - 1, 1))
        y = pad + (h - 2 * pad) * (1 - val / 100)
        pts.append(f"{x:.1f},{y:.1f}")
    poly = " ".join(pts)

    def bar(label: str, value: int) -> str:
        return (f'<div class="row"><span class="lbl">{html.escape(label)}</span>'
                f'<div class="track"><div class="fill" style="width:{value}%"></div></div>'
                f'<span class="val">{value}%</span></div>')

    tags = " ".join(f'<span class="tag">{html.escape(t)}</span>' for t in report["tags"])
    fv = report["feature_vector"]
    fv_txt = " · ".join(f"{k}={v}" for k, v in fv.items())
    meth = report["method"]
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Virality report: {html.escape(report['file'])}</title>
<style>
body{{margin:0;background:#0b1a1f;color:#e6f2f2;font-family:system-ui,sans-serif}}
main{{max-width:960px;margin:0 auto;padding:24px 16px 48px}}
.card{{background:#0f2228;border:1px solid #2b4a52;border-radius:14px;padding:18px;margin-top:14px}}
.big{{font-size:64px;font-weight:800;color:#f2b544}} .muted{{color:#86a4aa;font-size:13px}}
.row{{display:flex;align-items:center;gap:10px;margin:8px 0}} .lbl{{width:110px}}
.track{{flex:1;height:10px;background:#2b4a52;border-radius:6px;overflow:hidden}} .fill{{height:100%;background:#4fb7b0}}
.val{{width:48px;text-align:right}} .tag{{display:inline-block;border:1px solid #4fb7b0;border-radius:999px;padding:2px 10px;margin:2px;font-size:12px}}
svg{{width:100%;height:auto}}
</style></head><body><main>
<h1>Virality report</h1>
<div class="muted">{html.escape(report['file'])} · {report['meta']['width']}×{report['meta']['height']} · {report['meta']['duration']:.1f}s · band: {report['band']}</div>
<div class="card" style="text-align:center"><div class="big">{s['overall']}<span class="muted">/100</span></div><div class="muted">Overall heuristic score</div><div style="margin-top:10px">{tags}</div></div>
<div class="card"><div class="muted">Signals</div>{bar('Visual', s['visual'])}{bar('Attention', s['attention'])}{bar('Memory', s['memory'])}{bar('Hook (0–3s)', s['hook'])}{bar('Hearing', s['hearing'])}{bar('Language', s['language'])}</div>
<div class="card"><div class="muted">Feature vector (M, C, T, L, A)</div><div>{html.escape(fv_txt)}</div>
<div class="muted" style="margin-top:8px">Motion: {html.escape(meth['motion'])} · Audio FFT: {meth['audio_fft']}</div></div>
<div class="card"><div class="muted">Details</div><pre style="white-space:pre-wrap;font-size:13px">{html.escape(json.dumps(d, ensure_ascii=False, indent=2))}</pre></div>
<div class="card"><div class="muted">Estimated retention</div><svg viewBox="0 0 {w} {h}"><polyline points="{poly}" fill="none" stroke="#4fb7b0" stroke-width="3"/></svg></div>
<p class="muted">{html.escape(report['disclaimer'])} Thresholds: thresholds.json.</p>
</main></body></html>"""


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
    print(f"overall={s['overall']} band={report['band']} tags={','.join(report['tags'])} motion={report['method']['motion']}")
    print(f"report: {os.path.join(out_dir, 'report.html')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
