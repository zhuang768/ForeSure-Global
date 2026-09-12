"""Trace the supplied brand alpha into 3D modeling coordinates; never redraw the logo.

Run from the repo root. Requires Pillow, numpy and opencv-python (authoring only).
The small JSON contour is bundled locally; no image processing runs in the browser.
"""
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / "frontend/public/brand/logo-mark.png"
rgba = np.array(Image.open(source).convert("RGBA"))
mask = (rgba[:, :, 3] > 150).astype("uint8") * 255
contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
outline = max(contours, key=cv2.contourArea)
points = cv2.approxPolyDP(outline, 1.6, True)[:, 0, :]
x, y, width, height = cv2.boundingRect(outline)
normalized = [[round((float(px) - x - width / 2) / height * 3.8, 5),
               round((y + height / 2 - float(py)) / height * 3.8, 5)]
              for px, py in points]
target = ROOT / "frontend/src/lib/leafContour.json"
target.write_text(json.dumps({"source": "/brand/logo-mark.png", "points": normalized}, separators=(",", ":")) + "\n")
print(f"Traced {len(points)} vertices from {source.name} → {target.relative_to(ROOT)}")
