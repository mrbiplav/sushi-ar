#!/usr/bin/env python3
"""
Generate a print-ready image target for Sushi Rush AR.

Image-tracking quality is decided almost entirely by the target artwork, so this
is designed against the things that actually break MindAR tracking:

  * Rotational symmetry -> pose ambiguity. A plain round plate with evenly
    spaced sushi is the classic failure. Everything here is deliberately
    off-centre and unbalanced: the plate sits high-left, chopsticks run only
    bottom-right, ornament appears in one corner only.
  * Large flat regions -> nothing to latch onto. The paper carries speckle and
    linen texture, so even the "empty" areas yield micro-features.
  * Repeated identical motifs -> mismatched features. Every sushi piece differs
    in size, colour, angle and fill.
  * Low contrast -> weak corners. Dark plate on warm paper, plus text and a
    random block glyph patch, give strong high-frequency detail.

Output: target.png (1200x1200). Print at ~15 cm on matte paper.
"""

import math
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SIZE = 1200
SEED = 7                      # deterministic: same artwork every run

PAPER   = (243, 237, 226)
INK     = (28, 32, 38)
PLATE   = (32, 42, 52)
PLATE_R = (58, 72, 86)
RICE    = (250, 247, 240)
NORI    = (34, 52, 44)
SALMON  = (240, 126, 84)
TUNA    = (198, 62, 82)
EGG     = (238, 190, 68)
AVO     = (132, 176, 82)
WASABI  = (118, 176, 70)
GINGER  = (238, 186, 178)
ACCENT  = (196, 84, 60)

FONTS = {
    "bold":  "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    "reg":   "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    "mono":  "/usr/share/fonts/dejavu/DejaVuSansMono-Bold.ttf",
    "serif": "/usr/share/fonts/dejavu/DejaVuSerif-Bold.ttf",
    # .ttc is a font collection -> needs a face index, and DejaVu has no CJK
    # glyphs at all (they render as tofu boxes), so the kanji needs Noto.
    "cjk":   "/usr/share/fonts/google-noto-cjk/NotoSerifCJK-Black.ttc",
}


def font(kind, px):
    try:
        path = FONTS[kind]
        return ImageFont.truetype(path, px, index=0 if path.endswith(".ttc") else 0)
    except OSError:
        return ImageFont.load_default()


def paper_texture(img, rnd):
    """Speckle + linen weave: turns dead space into trackable micro-features."""
    px = img.load()
    for _ in range(90_000):
        x, y = rnd.randrange(SIZE), rnd.randrange(SIZE)
        r, g, b = px[x, y]
        d = rnd.randint(-16, 16)
        px[x, y] = (max(0, min(255, r + d)),
                    max(0, min(255, g + d)),
                    max(0, min(255, b + d)))
    weave = Image.new("RGB", (SIZE, SIZE), PAPER)
    wd = ImageDraw.Draw(weave)
    for i in range(-SIZE, SIZE * 2, 9):
        wd.line([(i, 0), (i + SIZE, SIZE)], fill=(232, 225, 212), width=1)
    for i in range(-SIZE, SIZE * 2, 13):
        wd.line([(i, SIZE), (i + SIZE, 0)], fill=(236, 230, 218), width=1)
    return Image.blend(img, weave, 0.22)


def nigiri(d, cx, cy, ang, w, top):
    """Rice pillow + fish slab, drawn as a rotated rounded pair."""
    layer = Image.new("RGBA", (w * 3, w * 3), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    o = w * 1.5
    ld.rounded_rectangle([o - w * .62, o - w * .34, o + w * .62, o + w * .40],
                         radius=int(w * .30), fill=RICE + (255,),
                         outline=(214, 206, 192, 255), width=3)
    ld.rounded_rectangle([o - w * .70, o - w * .50, o + w * .70, o + w * .06],
                         radius=int(w * .26), fill=top + (255,),
                         outline=(0, 0, 0, 46), width=3)
    for k in range(3):                      # marbling: extra unique features
        ly = o - w * .40 + k * w * .16
        ld.line([(o - w * .56, ly), (o + w * .56, ly - w * .04)],
                fill=(255, 255, 255, 96), width=max(2, w // 26))
    layer = layer.rotate(ang, resample=Image.BICUBIC, center=(o, o))
    return layer, (int(cx - o), int(cy - o))


def maki(d, cx, cy, r, fill, seedy):
    """Nori-wrapped roll seen end-on."""
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=NORI, outline=(18, 28, 24), width=3)
    ri = r * .80
    d.ellipse([cx - ri, cy - ri, cx + ri, cy + ri], fill=RICE, outline=(212, 204, 190), width=2)
    rc = r * .42
    d.ellipse([cx - rc, cy - rc, cx + rc, cy + rc], fill=fill, outline=(0, 0, 0, 40), width=2)
    rnd = random.Random(seedy)
    for _ in range(14):                     # sesame speckle
        a = rnd.uniform(0, 6.283)
        dist = rnd.uniform(rc * 1.3, ri * .92)
        sx, sy = cx + dist * math.cos(a), cy + dist * math.sin(a)
        d.ellipse([sx - 3, sy - 3, sx + 3, sy + 3], fill=(228, 220, 204))


def chopsticks(d):
    """Only bottom-right: strong linear features and a hard symmetry break."""
    for k, off in enumerate((0, 46)):
        x0, y0 = 690 + off, 1148
        x1, y1 = 1130 + off * .35, 720 - off * .5
        d.line([(x0, y0), (x1, y1)], fill=(150, 104, 62), width=22)
        d.line([(x0, y0), (x1, y1)], fill=(186, 138, 92), width=14)
        d.line([(x0 + 6, y0 - 8), (x0 + 150, y0 - 150)], fill=(120, 82, 48), width=16)


def glyph_patch(d, x, y, cells, cell, rnd):
    """Random block grid - a dense, perfectly unique feature cluster."""
    for gy in range(cells):
        for gx in range(cells):
            if rnd.random() < 0.46:
                d.rectangle([x + gx * cell, y + gy * cell,
                             x + gx * cell + cell - 2, y + gy * cell + cell - 2],
                            fill=INK)
    d.rectangle([x - 8, y - 8, x + cells * cell + 2, y + cells * cell + 2],
                outline=INK, width=3)


def main():
    rnd = random.Random(SEED)
    img = Image.new("RGB", (SIZE, SIZE), PAPER)
    img = paper_texture(img, rnd)
    d = ImageDraw.Draw(img, "RGBA")

    # ---- asymmetric frame: ticks on all sides, ornament in one corner only
    d.rectangle([26, 26, SIZE - 27, SIZE - 27], outline=INK, width=6)
    d.rectangle([44, 44, SIZE - 45, SIZE - 45], outline=(150, 142, 128), width=2)
    for i in range(70, SIZE - 70, 40):
        d.line([(i, 26), (i, 40)], fill=INK, width=3)
        d.line([(i, SIZE - 27), (i, SIZE - 41)], fill=INK, width=3)
    for i in range(70, SIZE - 70, 56):
        d.line([(26, i), (40, i)], fill=INK, width=3)
    d.arc([40, 40, 190, 190], 90, 180, fill=ACCENT, width=10)     # top-left only

    # ---- plate, pushed up and left so the composition is unbalanced
    PCX, PCY, PR = 520, 452, 330
    d.ellipse([PCX - PR, PCY - PR, PCX + PR, PCY + PR], fill=PLATE)
    d.ellipse([PCX - PR, PCY - PR, PCX + PR, PCY + PR], outline=PLATE_R, width=12)
    d.ellipse([PCX - PR + 34, PCY - PR + 34, PCX + PR - 34, PCY + PR - 34],
              outline=(46, 60, 74), width=4)
    d.arc([PCX - PR + 60, PCY - PR + 60, PCX + PR - 60, PCY + PR - 60],
          200, 340, fill=(70, 88, 104), width=6)

    # ---- maki cluster, varied sizes/fills, all left-of-centre
    maki(d, 372, 356, 84, AVO,    11)
    maki(d, 530, 300, 72, SALMON, 22)
    maki(d, 300, 520, 66, EGG,    33)

    # ---- nigiri, two different toppings at unrelated angles
    for cx, cy, ang, w, top in ((620, 470, -24, 210, SALMON),
                                (470, 640,  38, 186, TUNA)):
        layer, pos = nigiri(d, cx, cy, ang, w, top)
        img.paste(layer, pos, layer)
    d = ImageDraw.Draw(img, "RGBA")

    # ---- condiments, one side only
    d.ellipse([700, 300, 790, 372], fill=WASABI, outline=(84, 132, 48), width=4)
    d.ellipse([722, 318, 754, 342], fill=(150, 200, 96))
    for k in range(4):
        d.arc([690 + k * 16, 560 + k * 9, 810 + k * 16, 640 + k * 9],
              200, 20, fill=GINGER, width=9)

    # ---- soy dish, bottom-left, clipped by nothing else
    d.ellipse([118, 812, 322, 974], fill=(238, 231, 218), outline=INK, width=6)
    d.ellipse([152, 838, 288, 948], fill=(48, 34, 28))
    d.arc([166, 850, 274, 936], 190, 330, fill=(96, 72, 58), width=6)

    chopsticks(d)

    # ---- typography: excellent corner features, placed off-centre
    d.text((92, 1016), "SUSHI RUSH", font=font("bold", 86), fill=INK)
    d.text((372, 962), "SCAN  •  PLAY  •  AR",
           font=font("mono", 26), fill=(120, 112, 100))
    d.text((905, 118), "寿司", font=font("cjk", 108), fill=ACCENT)
    for i, ch in enumerate("TARGET-01"):
        d.text((1108, 560 + i * 34), ch, font=font("mono", 30), fill=(96, 90, 80))

    glyph_patch(d, 906, 300, 7, 26, rnd)      # right side only

    # ---- a few scattered registration marks (unique, tiny, high contrast)
    for x, y, r in ((860, 1024, 16), (1044, 1090, 11), (238, 760, 13), (792, 196, 9)):
        d.ellipse([x - r, y - r, x + r, y + r], outline=INK, width=4)
        d.line([(x - r - 8, y), (x + r + 8, y)], fill=INK, width=3)

    img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=70, threshold=3))
    img.save("target.png", "PNG", optimize=True)
    print(f"wrote target.png  {img.size[0]}x{img.size[1]}")


if __name__ == "__main__":
    main()
