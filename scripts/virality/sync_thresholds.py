#!/usr/bin/env python3
"""Copy thresholds.json into virality.html so the page and analyze.py share one set of values.

The page (public/virality/index.html) keeps its values between two markers:
    /*TH_START*/ ... /*TH_END*/
Run this after editing thresholds.json:
    python3 sync_thresholds.py
"""

from __future__ import annotations

import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "thresholds.json")
DST = os.path.join(HERE, "..", "..", "public", "virality", "index.html")
PATTERN = re.compile(r"/\*TH_START\*/.*?/\*TH_END\*/", re.S)


def main() -> int:
    with open(SRC, encoding="utf-8") as f:
        data = json.load(f)
    data.pop("_comment", None)
    block = "/*TH_START*/" + json.dumps(data, ensure_ascii=False, indent=2) + "/*TH_END*/"
    with open(DST, encoding="utf-8") as f:
        html_text = f.read()
    if not PATTERN.search(html_text):
        print("markers /*TH_START*/ ... /*TH_END*/ not found in virality.html", file=sys.stderr)
        return 1
    new_html = PATTERN.sub(lambda _m: block, html_text, count=1)
    with open(DST, "w", encoding="utf-8") as f:
        f.write(new_html)
    print("synced thresholds into virality.html")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
