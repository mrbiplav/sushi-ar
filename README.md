# Sushi Chef — NFC → WebAR game

Tap an NFC tag → browser opens → camera viewfinder → point at the sushi target →
a playable sushi-building game appears anchored on the plate. No app install.

## Files

| File | What it is |
|---|---|
| `index.html` | The entire game. Self-contained: inline CSS + JS, three.js/MindAR from CDN, all 3D geometry generated in code. No binary assets. |
| `target.png` | The image target. Print this (or show it on a second screen). |
| `targets.mind` | Pre-compiled MindAR descriptor for `target.png`. Already built — nothing to do. |
| `tools/make_target.py` | Regenerates `target.png`. |
| `tools/compile_target.mjs` | Compiles any image → `.mind`, offline. |

## 1. Try it with no target first

Serve the folder over HTTPS and open `index.html?demo=1`. Demo mode skips image
tracking entirely — the board floats in front of the camera so you can verify
the gameplay works before dealing with targets. There is **nothing to scan** in
demo mode; the camera feed is just a backdrop. The board auto-fits to your
screen's aspect ratio, so it works in portrait too.

Add `?debug=1` for an FPS / tracking-state readout.

## 2. Deploy

WebAR needs **HTTPS** — camera access is blocked on plain HTTP (except
`localhost`). GitHub Pages, Vercel, Netlify or Cloudflare Pages all work; it's
three static files, so any of them is a drag-and-drop.

```
index.html
target.png
targets.mind
```

## 3. Print the target

Print `target.png` at roughly **15 cm** square on **matte** paper.

- Matte matters — glossy paper throws glare that destroys tracking.
- Bigger is better. A small print means you must hold the phone close.
- A tablet/monitor showing the PNG also works, but screen glare and refresh
  banding make it less reliable than paper.

## 4. Write the NFC tag

Use **NTAG213/215/216** tags and any tag writer app (NFC Tools on Android/iOS,
or NXP TagWriter). Write a single **URL / URI record**:

```
https://your-host.example/sushi-ar/
```

- URL record, *not* plain text — a text record won't auto-open a browser.
- NTAG213 (144 bytes) is plenty for a URL.
- Optionally lock the tag afterwards so the URL can't be overwritten.
- Keep the URL short; it's all that has to fit.

### Phone behaviour

- **iPhone XS and newer** — reads tags in the background with the screen on. A
  notification banner appears; tapping it opens Safari.
- **iPhone 7/8/X** — no background scanning. Use the **NFC Reader** item in
  Control Center.
- **Android** — NFC must be enabled in settings; the tag opens Chrome directly.

## 5. Gameplay

You're the chef. An **order ticket** names a sushi; ingredients float in a ring
around the plate. Tap them **in the right order** to build it — the stack grows
piece by piece in front of you, and the ticket ticks off each step as you go.

- **Order matters.** Nori before rice before the fill. The ticket shows the
  sequence; the next step is highlighted.
- **Decoys.** The ring always holds ingredients the recipe doesn't want.
- **3 tries, and that's it.** A wrong ingredient or a timed-out order burns one.
  Three gone → game over.
- **Timer per order**, scaled to recipe length. It gets shorter as you serve
  more. The last 30% ticks audibly.
- **Score** = 300 per order + up to 240 speed bonus, multiplied by a streak
  bonus that steps up every 3 consecutive orders (×1.5, ×2.0, …). Partial credit
  lands on each correct pick. A wrong pick resets the streak.
- **Difficulty ramp.** Recipes grow from 2 to 5 steps (every 3 orders) and the
  ring grows from 4 to 8 slots (every 2 orders).

14 recipes across nigiri and maki — Salmon Nigiri, Kappa Maki, California Roll,
Rainbow Roll, Chef's Special — drawn from 12 procedurally modelled ingredients.

If the target goes out of frame the round **pauses** rather than punishing you,
and resumes when tracking recovers.

## Using your own target image

Any image works, but tracking quality is decided almost entirely by the artwork:

- **Avoid rotational symmetry.** A round plate with evenly spaced sushi is the
  classic failure — the tracker can't tell which way is up. Keep the composition
  deliberately lopsided.
- **Avoid large flat areas** and repeated identical motifs.
- **Want** dense, high-contrast, non-repeating detail. Text and fine texture are
  excellent features.

Easiest path — MindAR's browser compiler:
<https://hiukim.github.io/mind-ar-js-doc/tools/compile> → drop your image →
download `targets.mind` → replace the file.

Or offline:

```sh
npm install mind-ar@1.2.5 canvas
node tools/compile_target.mjs my-image.png targets.mind
```

It prints a feature count and a verdict. `target.png` scores 2777 detection
points over 12 scale levels and 35 tracking points. If your own image reports
well under a few hundred detection points, fix the artwork rather than fighting
the tracker.

You can also point the game at a different descriptor without editing anything:
`index.html?target=./other.mind`

## Version pins — do not bump casually

`mind-ar@1.2.5` imports `sRGBEncoding` from three, which was **removed in three
r162**. Using three ≥ 0.162 fails at import with
*"does not provide an export named 'sRGBEncoding'"* and the page stays black.
The importmap in `index.html` pins **three@0.160.0** deliberately.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Black screen, no camera | Not served over HTTPS, or permission denied. The page shows the actual error — read it. |
| "Could not load the image target" | `targets.mind` isn't next to `index.html`. Or use `?demo=1`. |
| Camera works, nothing appears | Target not recognised: too small, glare, bad light, or too far. A teal ring appears the instant it locks on. |
| Lock keeps dropping | Print bigger, kill glare, add light. |
| Nothing happens on iPhone when tapping the tag | Older iPhone without background scanning — use the Control Center NFC reader. |

## Limitation worth knowing

This tracks a **flat printed image**. It will not reliably track a *real 3D
plate of actual sushi* — that's object recognition, a substantially different
problem needing a trained model or a service like Niantic VPS. If you want the
trigger to be real food rather than a printed card, that's a different build.
