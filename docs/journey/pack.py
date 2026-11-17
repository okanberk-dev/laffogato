"""
Graded frames (grade.py) to the packs the site loads.

    python pack.py --wide out/web-wide --tall out/web-tall --dest <repo>/src/components/laffogato/journey/frames

Each cut becomes five packs: frames 0-7 (what the preloader waits for and
the first stretch of the scroll), then four of 28. A pack is the frames' own
WebP files laid end to end, colour then depth; index.json says where each
starts. A frame that has not been rendered yet is simply left out: the site
draws its nearest neighbour.
"""

import argparse
import json
import os

FRAME_COUNT = 120
GROUPS = [(0, 7), (8, 35), (36, 63), (64, 91), (92, 119)]

parser = argparse.ArgumentParser()
parser.add_argument("--wide", required=True)
parser.add_argument("--tall", required=True)
parser.add_argument("--dest", required=True)
args = parser.parse_args()

os.makedirs(args.dest, exist_ok=True)
index = {"count": FRAME_COUNT}
for cut, src in (("wide", args.wide), ("tall", args.tall)):
    packs = []
    total = 0
    have = 0
    for number, (first, last) in enumerate(GROUPS):
        name = f"{cut}-{number}.bin"
        frames = []
        blob = bytearray()
        for frame in range(first, last + 1):
            colour = os.path.join(src, f"f{frame:03d}.webp")
            depth = os.path.join(src, f"d{frame:03d}.webp")
            if not (os.path.exists(colour) and os.path.exists(depth)):
                continue
            c = open(colour, "rb").read()
            d = open(depth, "rb").read()
            frames.append([frame, len(blob), len(c), len(blob) + len(c), len(d)])
            blob += c
            blob += d
            have += 1
        with open(os.path.join(args.dest, name), "wb") as handle:
            handle.write(blob)
        total += len(blob)
        packs.append({"file": name, "frames": frames})
        print(f"{name}: {len(frames)} frames, {len(blob) / 1024:.0f} KB")
    index[cut] = {"packs": packs}
    print(f"{cut}: {have}/{FRAME_COUNT} frames, {total / 1048576:.2f} MB")

with open(os.path.join(args.dest, "index.json"), "w") as handle:
    json.dump(index, handle, separators=(",", ":"))
    handle.write("\n")
