"""Generate the matching Apple touch icon using only the Python standard library."""
import math
import struct
import zlib
from pathlib import Path

size = 180
background = (0, 0, 0)
accent = (255, 255, 255)


def rounded_box(x, y, low, high, radius):
    cx = min(max(x, low + radius), high - radius)
    cy = min(max(y, low + radius), high - radius)
    return low <= x <= high and low <= y <= high and math.hypot(x - cx, y - cy) <= radius


pixels = bytearray()
for y in range(size):
    pixels.append(0)
    for x in range(size):
        samples = []
        for dy in (0.25, 0.75):
            for dx in (0.25, 0.75):
                px, py = x + dx, y + dy
                border = rounded_box(px, py, 21, 159, 28) and not rounded_box(px, py, 24, 156, 25)
                circles = any(math.hypot(px - cx, py - cy) <= 23 for cx, cy in ((90, 61), (66, 91), (114, 91)))
                stem = 92 <= py <= 134 and abs(px - 90) <= 3 + 16 * ((py - 92) / 42) ** 2
                samples.append(accent if border or circles or stem else background)
        pixels.extend(round(sum(sample[c] for sample in samples) / len(samples)) for c in range(3))


def chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)


data = b'\x89PNG\r\n\x1a\n'
data += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
data += chunk(b'IDAT', zlib.compress(bytes(pixels)))
data += chunk(b'IEND', b'')
Path(__file__).resolve().parent.parent.joinpath('apple-touch-icon.png').write_bytes(data)
