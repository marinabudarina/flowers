# Bead normal-map lighting

The Google logo and reverse-side beaded 4 OpenGL normal maps were generated with
[Sprite Fusion Sprite Normals](https://github.com/Hugo-Dz/spritefusion-sprite-normals),
by Hugo Duprez, under the MIT license. The generator is used at build time only.
The browser loads the precomputed PNG, not a Rust runtime, WASM generator, or model.

To regenerate after changing the source artwork (requires Rust 1.85+, Git and
ImageMagick):

```sh
bash artifacts/collectible-cards/scripts/generate-bead-normals.sh
```

The script pins the generator revision, derives alpha from the source's black
background, preserves the original 768px resolution, and records all generation
settings. Treat the normal PNG as data, not an sRGB color image.

Runtime lighting decodes and normalizes tangent-space normals once, then uses
diffuse and specular response to a pointer-driven studio light. Its light and
view vectors are transformed into the rotating card's local space. A strong
low colored fill preserves the reference colors in shadow, with distinctly
darker unlit regions so the cursor's light stands out.
The pointer aims a localized studio spot across the artwork in both axes.
Its spatial falloff and the normal map produce clear moving bead highlights.
The lit texture is drawn onto **one** existing relief surface; no copies or
fake extrusion layers are added. A soft diagonal shimmer and intermittent
four-point glints are drawn into this same material, following its relief.
Glints choose bright artwork pixels rather than empty background positions.

Lighting buffers are reused; ambient accents update at 25fps while tilt remains
display-smooth. Only the facing side renders. Hidden tabs stop rendering, and
reduced-motion preferences disable timed accents and leave static lighting.

## Sprite Fusion MIT license

Copyright (c) 2026 Hugo Duprez

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
