"""
Scene-linear EXR frames (scene.py) to the frames the site loads: a graded
colour picture and a depth map (white = near).

    venv/bin/python grade.py out/test --preview

--preview writes PNGs next to the EXRs for looking at; without it the colour
and depth frames go to --dest as WebP at their final sizes.
"""

import argparse
import glob
import json
import os
import sys

import numpy as np
import OpenEXR
from PIL import Image
from scipy.ndimage import gaussian_filter

parser = argparse.ArgumentParser()
parser.add_argument("src")
parser.add_argument("--preview", action="store_true")
parser.add_argument("--dest", default="")
parser.add_argument("--size", default="")
parser.add_argument("--quality", type=int, default=78)
parser.add_argument("--depth-quality", type=int, default=70)
parser.add_argument("--exposure", type=float, default=0.0)
args = parser.parse_args()


def read(path):
    """Colour and mist from a multilayer (multipart) EXR."""
    rgba, mist = None, None
    with OpenEXR.File(path) as f:
        for part in f.parts:
            for name, channel in part.channels.items():
                if "Noisy" in name:
                    continue
                if "Combined" in name and rgba is None:
                    rgba = channel.pixels
                elif "Mist" in name:
                    mist = channel.pixels
    rgb = np.asarray(rgba[..., :3], dtype=np.float32)
    if mist is not None:
        mist = np.asarray(mist, dtype=np.float32)
        if mist.ndim == 3:
            mist = mist[..., 0]
    return rgb, mist


def tone(x):
    """A filmic curve (Hable), normalised so scene white lands at 1."""

    def hable(v):
        a, b, c, d, e, f = 0.22, 0.30, 0.10, 0.20, 0.01, 0.30
        return ((v * (a * v + c * b) + d * e) / (v * (a * v + b) + d * f)) - e / f

    return hable(x) / hable(np.float32(11.2))


def srgb(x):
    x = np.clip(x, 0.0, 1.0)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)


MIST_DEPTH = 400.0  # scene.py: world.mist_settings.depth (cm)
NEAR, FAR = 1.6, 160.0  # the range the depth map spends its greys on
LUMA = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)


def grade(rgb, mist, inside=0.0):
    h, w, _ = rgb.shape
    x = np.maximum(rgb, 0) * (2.0 ** (args.exposure + 0.6 * inside))

    # The lens's own glow round the lamps and the wet highlights.
    luma = (x * LUMA).sum(-1, keepdims=True)
    hot = x * np.clip((luma - 1.2) / 2.0, 0.0, 1.0)
    glow = np.zeros_like(x)
    for sigma, weight in ((w * 0.006, 0.5), (w * 0.022, 0.32), (w * 0.07, 0.18)):
        glow += weight * gaussian_filter(hot, sigma=(sigma, sigma, 0))
    x = x + glow * 0.55

    y = tone(x * 1.9)

    # A little more colour, a little more contrast.
    y = np.clip(y, 0, None)
    l2 = (y * LUMA).sum(-1, keepdims=True)
    y = l2 + (y - l2) * 1.1
    y = np.clip(y, 0, 1) ** 1.08

    # The blacks sit on the roast (#23120b's family), never on grey.
    shadow = np.clip(1.0 - l2 * 4.0, 0, 1) ** 2
    y = y + shadow * np.array([0.02, 0.009, 0.004], dtype=np.float32)

    # A soft lens vignette.
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.hypot((xx / w - 0.5) * 1.1, (yy / h - 0.5) * 1.0) / 0.74
    y = y * (1.0 - 0.28 * np.clip(r, 0, 1.4) ** 2.6)[..., None]

    out = (srgb(y) * 255.0 + 0.5).astype(np.uint8)

    depth = None
    if mist is not None:
        dist = np.clip(np.clip(mist, 0, 1) * MIST_DEPTH, NEAR, FAR)
        disparity = (1 / dist - 1 / FAR) / (1 / NEAR - 1 / FAR)
        depth = (np.clip(np.clip(disparity, 0, 1) ** 0.42 * 1.4, 0, 1) * 255.0 + 0.5).astype(np.uint8)
    return out, depth


def parse_size(spec):
    return tuple(int(v) for v in spec.split("x")) if spec else None


files = sorted(glob.glob(os.path.join(args.src, "f*.exr")))
meta_path = os.path.join(args.src, "meta.json")
META = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
if not files:
    sys.exit("no frames")
if args.dest:
    os.makedirs(args.dest, exist_ok=True)
for path in files:
    rgb, mist = read(path)
    stem = os.path.splitext(os.path.basename(path))[0]
    if args.dest and os.path.exists(os.path.join(args.dest, f"d{stem[1:]}.webp")):
        continue
    inside = float(META.get(str(int(stem[1:])), {}).get("inside", 0.0))
    colour, depth = grade(rgb, mist, inside)
    image = Image.fromarray(colour, "RGB")
    if args.preview:
        image.save(os.path.join(args.src, f"{stem}.png"))
        if depth is not None:
            Image.fromarray(depth, "L").save(os.path.join(args.src, f"{stem}-depth.png"))
        continue
    size = parse_size(args.size)
    if size and size != image.size:
        image = image.resize(size, Image.LANCZOS)
    # The dark, soft frames inside the mound take a harder squeeze.
    quality = args.quality - (8 if inside > 0.9 else 0)
    image.save(os.path.join(args.dest, f"{stem}.webp"), "WEBP", quality=quality, method=6)
    if depth is not None:
        d = Image.fromarray(depth, "L")
        d = d.resize((image.size[0] // 2, image.size[1] // 2), Image.LANCZOS)
        d.save(
            os.path.join(args.dest, f"d{stem[1:]}.webp"),
            "WEBP",
            quality=args.depth_quality,
            method=6,
        )
print(f"{len(files)} frames")
