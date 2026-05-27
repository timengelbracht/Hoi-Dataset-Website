#!/usr/bin/env python3
"""
Generate static/data/manifest.json from the Bonndata Dataverse API.

Run once after each new data upload:
    python3 scripts/generate_manifest.py
"""

import json
import urllib.request
from pathlib import Path

DATAVERSE_BASE = "https://bonndata.uni-bonn.de"
DATASET_DOI    = "doi:10.60507/FK2/QODWTV"
DATASET_VER    = ":latest"
OUT_PATH       = Path(__file__).parent.parent / "static" / "data" / "manifest.json"

def fetch_files():
    url = (
        f"{DATAVERSE_BASE}/api/datasets/:persistentId/versions/{DATASET_VER}/files"
        f"?persistentId={DATASET_DOI}"
    )
    print(f"Fetching {url} …")
    with urllib.request.urlopen(url, timeout=60) as resp:
        data = json.loads(resp.read().decode())
    if data.get("status") != "OK":
        raise RuntimeError(f"API error: {data.get('message', data)}")
    return data["data"]

def slim_entry(raw):
    df  = raw.get("dataFile") or raw
    dir_label = raw.get("directoryLabel", "")
    fn  = df.get("filename") or raw.get("label", "")
    path = f"{dir_label}/{fn}" if dir_label else fn
    return {"id": df.get("id") or raw.get("id"), "path": path, "size": df.get("filesize", 0)}

def main():
    raw   = fetch_files()
    slim  = [slim_entry(e) for e in raw]
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(slim, separators=(",", ":")))
    print(f"Wrote {len(slim)} files → {OUT_PATH}")

if __name__ == "__main__":
    main()
