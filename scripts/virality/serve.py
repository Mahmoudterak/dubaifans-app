#!/usr/bin/env python3
"""Small local web page around analyze.py.

Open the page, drop a video in, and the report appears on the same page.

Usage:
    python3 serve.py [--host 127.0.0.1] [--port 8080]

Routes:
    GET  /         upload page
    POST /analyze  raw video bytes in the body (?name=file.mp4) -> HTML report

This is a local tool. It accepts uploads of up to MAX_BYTES and writes them to
a temporary directory that is removed after each request.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import sys
import tempfile
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import analyze  # noqa: E402

MAX_BYTES = 150 * 1024 * 1024
ALLOWED_EXT = {".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi"}

PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Virality Predictor (local)</title>
<style>
:root { --bg:#0b1a1f; --panel:#0f2228; --line:#2b4a52; --text:#e6f2f2; --muted:#7f9ca2; --teal:#4fb7b0; --gold:#f2b544; }
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) { --bg:#eef5f5; --panel:#ffffff; --line:#c9dadd; --text:#10262b; --muted:#56727a; }
}
body { margin:0; background:var(--bg); color:var(--text); font-family: system-ui, sans-serif; min-height:100vh; }
main { max-width: 960px; margin: 0 auto; padding: 24px 16px 48px; }
h1 { font-size: 22px; margin: 0 0 6px; }
.sub { color: var(--muted); font-size: 14px; margin-bottom: 20px; line-height: 1.5; }
.drop { background: var(--panel); border: 2px dashed var(--line); border-radius: 16px; padding: 40px 20px; text-align: center; cursor: pointer; }
.drop.over { border-color: var(--teal); }
.drop strong { display:block; font-size: 17px; margin-bottom: 6px; }
.drop span { color: var(--muted); font-size: 13px; }
input[type=file] { display: none; }
button { margin-top: 14px; background: var(--teal); color: #052024; border: 0; border-radius: 10px; padding: 10px 18px; font-weight: 700; font-size: 15px; cursor: pointer; }
button:disabled { opacity: .5; cursor: default; }
#status { margin-top: 14px; color: var(--muted); font-size: 14px; min-height: 20px; }
#status.err { color: #e08b7f; }
iframe { width: 100%; height: 1400px; border: 1px solid var(--line); border-radius: 14px; margin-top: 18px; background: var(--bg); }
</style>
</head>
<body>
<main>
  <h1>Virality Predictor (local)</h1>
  <p class="sub">Heuristic scores from motion, cuts, contrast, colour and loudness. This is not Higgsfield's model.</p>

  <label class="drop" id="drop">
    <strong>Drop a video here or click to choose one</strong>
    <span>MP4, MOV, WebM, MKV, AVI · up to 150 MB · short clips give the most reliable result</span>
    <input type="file" id="file" accept="video/*">
  </label>

  <div style="text-align:center">
    <button id="go" disabled>Analyse</button>
  </div>
  <div id="status"></div>
  <div id="out"></div>
</main>
<script>
const drop = document.getElementById('drop');
const input = document.getElementById('file');
const go = document.getElementById('go');
const status = document.getElementById('status');
const out = document.getElementById('out');
let chosen = null;

function pick(f) {
  if (!f) return;
  chosen = f;
  go.disabled = false;
  status.className = '';
  status.textContent = f.name + ' · ' + (f.size / 1048576).toFixed(1) + ' MB';
}
input.addEventListener('change', () => pick(input.files[0]));
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', e => {
  e.preventDefault(); drop.classList.remove('over');
  pick(e.dataTransfer.files[0]);
});

go.addEventListener('click', async () => {
  if (!chosen) return;
  go.disabled = true;
  out.innerHTML = '';
  status.className = '';
  status.textContent = 'Analysing… this can take a little while for longer videos.';
  try {
    const res = await fetch('/analyze?name=' + encodeURIComponent(chosen.name), {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: chosen
    });
    const text = await res.text();
    if (!res.ok) throw new Error(text || ('HTTP ' + res.status));
    status.textContent = 'Done.';
    const frame = document.createElement('iframe');
    frame.setAttribute('title', 'Report');
    frame.srcdoc = text;
    out.appendChild(frame);
    frame.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    status.className = 'err';
    status.textContent = 'Failed: ' + err.message;
  } finally {
    go.disabled = false;
  }
});
</script>
</body>
</html>
"""


class Handler(BaseHTTPRequestHandler):
    server_version = "ViralityLocal/1.0"

    def log_message(self, fmt, *args):  # keep the console quiet
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _send(self, code: int, body: str, ctype: str = "text/html; charset=utf-8") -> None:
        data = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):  # noqa: N802
        if urlparse(self.path).path in ("/", "/index.html"):
            self._send(200, PAGE)
        else:
            self._send(404, "not found", "text/plain; charset=utf-8")

    def do_POST(self):  # noqa: N802
        url = urlparse(self.path)
        if url.path != "/analyze":
            self._send(404, "not found", "text/plain; charset=utf-8")
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0:
            self._send(400, "empty upload", "text/plain; charset=utf-8")
            return
        if length > MAX_BYTES:
            self._send(413, "file is larger than 150 MB", "text/plain; charset=utf-8")
            return

        name = parse_qs(url.query).get("name", ["upload.mp4"])[0]
        ext = os.path.splitext(name)[1].lower()
        if ext not in ALLOWED_EXT:
            self._send(415, "unsupported file type: " + html.escape(ext or "none"), "text/plain; charset=utf-8")
            return

        with tempfile.TemporaryDirectory(prefix="virality-") as tmp:
            path = os.path.join(tmp, "input" + ext)
            remaining = length
            with open(path, "wb") as f:
                while remaining > 0:
                    chunk = self.rfile.read(min(1 << 20, remaining))
                    if not chunk:
                        break
                    f.write(chunk)
                    remaining -= len(chunk)
            if remaining:
                self._send(400, "upload was cut short", "text/plain; charset=utf-8")
                return
            try:
                report = analyze.analyse(path)
                report["file"] = name
                page = analyze.render_html(report)
            except Exception as exc:  # report the error to the page
                traceback.print_exc()
                msg = str(exc).strip().splitlines()[-1] if str(exc).strip() else "analysis failed"
                self._send(422, "Could not analyse this file: " + html.escape(msg), "text/plain; charset=utf-8")
                return

        self._send(200, page)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8080)
    args = ap.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Virality page on http://{args.host}:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
